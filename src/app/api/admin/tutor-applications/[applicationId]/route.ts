import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { REVIEW_STATUS_VALUES, type ReviewStatus } from "@/lib/studyroom/tutorApplicationFields";

// Admin-only triage update. tutorApplications denies all client writes in
// firestore.rules (allow write: if false), so even an admin must go through
// this Admin-SDK route — matches the pattern used by
// /api/admin/tutor-access/decision. Only ever writes reviewStatus + updatedAt;
// never touches role/approved/tutorAccess/profileStatus or any other field.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const token = readBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const actorEmail = (decoded.email || "").toLowerCase();
    const isAdmin = decoded.role === "admin" || isAdminEmail(actorEmail);
    if (!isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { reviewStatus?: string };
    const reviewStatus = body.reviewStatus as ReviewStatus | undefined;
    if (!reviewStatus || !(REVIEW_STATUS_VALUES as readonly string[]).includes(reviewStatus)) {
      return NextResponse.json({ error: "Invalid reviewStatus." }, { status: 400 });
    }

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId." }, { status: 400 });
    }

    const ref = db.collection("tutorApplications").doc(applicationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    await ref.set(
      { reviewStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ ok: true, reviewStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
