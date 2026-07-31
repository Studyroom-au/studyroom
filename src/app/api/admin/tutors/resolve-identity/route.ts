import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { resolveTutorNameFromLeads } from "@/lib/studyroom/tutorIdentity";

// Admin-only, on-demand identity backfill for tutors who signed up before the
// canonical identity fix existed (so users/{uid} never got an email/name
// written at signup time). Firebase Auth is always the authoritative source
// for email — the account cannot exist without one — so this is safe to
// resolve immediately rather than waiting for the tutor to next load their
// own profile page. Never overwrites a name an admin has already set.
export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail((decoded.email || "").toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { uids?: unknown };
    const uids = Array.isArray(body.uids)
      ? body.uids.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 100)
      : [];
    if (uids.length === 0) {
      return NextResponse.json({ identities: {} });
    }

    const db = getAdminDb();
    const identities: Record<string, { name: string; email: string }> = {};

    await Promise.all(
      uids.map(async (uid) => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        const existing = userSnap.exists ? (userSnap.data() ?? {}) : {};
        const existingEmail = String(existing.email ?? "").trim().toLowerCase();
        const existingName = String(existing.name ?? existing.displayName ?? "").trim();

        let email = existingEmail;
        if (!email) {
          try {
            const authUser = await adminAuth.getUser(uid);
            email = (authUser.email || "").toLowerCase();
          } catch {
            // Auth record genuinely doesn't exist (deleted account, bad uid) — leave blank.
          }
        }

        let name = existingName;
        if (!name && email) {
          name = await resolveTutorNameFromLeads(db, email);
        }

        identities[uid] = { name, email };

        const patch: Record<string, unknown> = {};
        if (email && !existingEmail) patch.email = email;
        if (name && !existingName) patch.name = name;
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = FieldValue.serverTimestamp();
          await userRef.set(patch, { merge: true });
        }
      })
    );

    return NextResponse.json({ identities });
  } catch (err) {
    console.error("[admin/tutors/resolve-identity]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
