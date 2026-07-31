import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { OPERATIONS_CUTOVER_COLLECTION, OPERATIONS_CUTOVER_DOC_ID } from "@/lib/studyroom/operationsCutover";

// The ONLY write path for settings/operationsCutover — firestore.rules
// blocks every client-side write to any doc under settings/ (see
// `match /settings/{docId}`). Admin-only.
//
// This never touches any session/invoice/plan/lead document — it only
// changes which sessions the derived Needs Attention queries on
// /hub/admin and /hub/admin/sessions are allowed to flag. Historical
// records remain fully browseable regardless of this value.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: Request) {
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
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { operationsCutoverAt?: string };
    const operationsCutoverAt = String(body.operationsCutoverAt ?? "").trim();
    if (!operationsCutoverAt) {
      return NextResponse.json({ error: "operationsCutoverAt is required." }, { status: 400 });
    }
    const parsed = new Date(operationsCutoverAt);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "operationsCutoverAt must be a valid date/time string." }, { status: 400 });
    }

    await db
      .collection(OPERATIONS_CUTOVER_COLLECTION)
      .doc(OPERATIONS_CUTOVER_DOC_ID)
      .set(
        {
          operationsCutoverAt,
          updatedBy: decoded.email ?? decoded.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, operationsCutoverAt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update operations cutover";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
