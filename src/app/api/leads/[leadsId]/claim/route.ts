import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminApp, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

type LeadStatus = "new" | "claimed" | "converted" | "closed";

export async function POST(
  req: Request,
  context: { params: Promise<{ leadsId: string }> }
) {
  try {
    const app = getAdminApp();
    const db = admin.firestore(app);

    const decoded = await verifyIdTokenFromRequest(req);
    const tutorUid = decoded.uid;
    const tutorEmail = decoded.email ?? null;

    const params = await Promise.resolve(context.params);
    const { leadsId: leadId } = params;

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "Missing leadId." }, { status: 400 });
    }

    const leadRef = db.collection("leads").doc(leadId);
    const studentRef = db.collection("students").doc(leadId);
    const clientRef = db.collection("clients").doc(leadId);
    const userRef = db.collection("users").doc(tutorUid);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists) throw new Error("User not found.");

      const userData = userSnap.data()!;
      const role = userData.role;

      if (role !== "tutor" && role !== "admin") {
        throw new Error("Unauthorized role.");
      }

      const tutorName =
        typeof userData.name === "string" ? userData.name : null;

      const leadSnap = await tx.get(leadRef);
      if (!leadSnap.exists) throw new Error("Lead not found.");

      const lead = leadSnap.data() as any;

      const status: LeadStatus = lead.status || "new";
      const claimedTutorId = lead.claimedTutorId ?? null;

      if (status !== "new") throw new Error("This lead is not available.");
      if (claimedTutorId) throw new Error("Already claimed.");

      tx.update(leadRef, {
        status: "claimed",
        claimedTutorId: tutorUid,
        claimedTutorEmail: tutorEmail,
        claimedTutorName: tutorName,

        assignedTutorId: tutorUid,
        assignedTutorEmail: tutorEmail,
        assignedTutorName: tutorName,

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),

        clientId: leadId,
        studentId: leadId,
      });

      tx.set(
        clientRef,
        {
          parentName: lead.parentName ?? null,
          parentEmail: lead.parentEmail ?? null,
          parentPhone: lead.parentPhone ?? null,

          assignedTutorId: tutorUid,
          assignedTutorEmail: tutorEmail,
          assignedTutorName: tutorName,

          status: "active",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        studentRef,
        {
          clientId: leadId,

          studentName: lead.studentName ?? null,
          yearLevel: lead.yearLevel ?? null,
          school: lead.school ?? null,

          subjects: Array.isArray(lead.subjects) ? lead.subjects : [],

          assignedTutorId: tutorUid,
          assignedTutorEmail: tutorEmail,
          assignedTutorName: tutorName,

          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { studentId: leadId };
    });

    return NextResponse.json({ ok: true, studentId: result.studentId }, { status: 200 });

  } catch (err: any) {
    console.error("[claim] failed:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Claim failed." },
      { status: 400 }
    );
  }
}