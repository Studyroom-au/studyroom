import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminApp, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

const ADMIN_EMAILS = new Set([
  "lily.studyroom@gmail.com",
  "contact.studyroomaustralia@gmail.com",
]);

const ALLOWED_STATUSES = new Set(["active", "paused", "pending_review"]);

export async function POST(
  req: Request,
  context: { params: Promise<{ tutorId: string }> }
) {
  try {
    const app = getAdminApp();
    const db = admin.firestore(app);

    const decoded = await verifyIdTokenFromRequest(req);
    const callerEmail = (decoded.email ?? "").toLowerCase();
    const isAdminUser = decoded.role === "admin" || ADMIN_EMAILS.has(callerEmail);

    if (!isAdminUser) {
      return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
    }

    const params = await Promise.resolve(context.params);
    const { tutorId } = params;

    if (!tutorId) {
      return NextResponse.json({ ok: false, error: "Missing tutorId." }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const newStatus = body.profileStatus;
    if (typeof newStatus !== "string" || !ALLOWED_STATUSES.has(newStatus)) {
      return NextResponse.json(
        { ok: false, error: `profileStatus must be one of: ${[...ALLOWED_STATUSES].join(", ")}.` },
        { status: 400 }
      );
    }

    // Check profile exists — do not create if missing
    const profileRef = db.collection("tutors").doc(tutorId);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Tutor profile does not exist." },
        { status: 404 }
      );
    }

    await profileRef.update({
      profileStatus: newStatus,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: decoded.email ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, profileStatus: newStatus });
  } catch (err: unknown) {
    console.error("[admin tutor profile-status] failed:", err);
    const message = err instanceof Error ? err.message : "Update failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
