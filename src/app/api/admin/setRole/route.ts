import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

const ALLOWED_ROLES = new Set(["student", "tutor", "admin"] as const);
const ALLOWED_ADMIN_EMAILS = new Set(["lily.studyroom@gmail.com"]);

type AllowedRole = "student" | "tutor" | "admin";

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: Request) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();

  if (!adminAuth || !db) {
    return NextResponse.json(
      { error: "Admin SDK missing environment vars." },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      idToken?: string;
      targetUid?: string;
      role?: string;
    };

    const actorToken = readBearerToken(req) || body.idToken;
    if (!actorToken) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(actorToken);
    const actorEmail = (decoded.email || "").toLowerCase();

    const isAdmin =
      decoded.role === "admin" ||
      ALLOWED_ADMIN_EMAILS.has(actorEmail);

    if (!isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const targetUid = String(body.targetUid || "").trim();
    const role = String(body.role || "").trim() as AllowedRole;

    if (!targetUid || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Missing or invalid targetUid/role." },
        { status: 400 }
      );
    }

    await adminAuth.setCustomUserClaims(targetUid, { role });

    const batch = db.batch();
    batch.set(
      db.collection("roles").doc(targetUid),
      { role, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    batch.set(
      db.collection("users").doc(targetUid),
      { role, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ ok: true, targetUid, role });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to set role" },
      { status: 500 }
    );
  }
}
