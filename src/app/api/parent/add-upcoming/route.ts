import { NextRequest, NextResponse } from "next/server";
import { verifyIdTokenFromRequest, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

async function resolveParentClientId(
  db: ReturnType<typeof getAdminDb>,
  parentUid: string,
  parentEmail: string,
): Promise<string | null> {
  let snap = await db.collection("clients").where("parentUid", "==", parentUid).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  if (!parentEmail) return null;
  snap = await db.collection("clients").where("parentEmail", "==", parentEmail).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: NextRequest) {
  try {
    let decoded: Awaited<ReturnType<typeof verifyIdTokenFromRequest>>;
    try {
      decoded = await verifyIdTokenFromRequest(req);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parentUid = decoded.uid;
    const parentEmail = decoded.email?.toLowerCase() ?? "";

    const body = await req.json() as {
      title?: unknown;
      subject?: unknown;
      dueDate?: unknown;
      type?: unknown;
      studentId?: unknown;
    };

    const title = String(body.title ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const dueDate = String(body.dueDate ?? "").trim();
    const type = String(body.type ?? "assessment").trim();
    const studentId = String(body.studentId ?? "").trim();

    if (!title || !dueDate) return NextResponse.json({ error: "title and dueDate required" }, { status: 400 });
    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    const db = getAdminDb();

    // Verify studentId belongs to this parent's client
    const clientId = await resolveParentClientId(db, parentUid, parentEmail);
    if (!clientId) return NextResponse.json({ error: "not_linked" }, { status: 404 });

    const studentDoc = await db.collection("students").doc(studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.clientId !== clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const hubUid = String(studentDoc.data()?.hubUid ?? "");
    if (!hubUid) return NextResponse.json({ error: "Student has no hub account" }, { status: 400 });

    await db.collection("users").doc(hubUid).collection("upcoming").add({
      title,
      subject,
      dueDate,
      type,
      completed: false,
      status: "Not started",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[parent/add-upcoming]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
