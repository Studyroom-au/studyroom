import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminApp, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

type LeadStatus = "new" | "claimed" | "converted" | "closed";

export async function POST(
  req: Request,
  context: { params: Promise<{ leadsId?: string; leadId?: string }> | { leadsId?: string; leadId?: string } }
) {
  const app = getAdminApp();
  if (!app) {
    return NextResponse.json(
      { ok: false, error: "Server not configured (Firebase Admin missing env vars)." },
      { status: 500 }
    );
  }

  const db = admin.firestore(app);

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await verifyIdTokenFromRequest(req);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unauthorized." },
      { status: 401 }
    );
  }

  const tutorUid = decoded.uid;
  const tutorEmail = decoded.email ?? null;

  const params = await Promise.resolve(context.params);
  const leadId = params.leadsId ?? params.leadId;
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "Missing leadId." }, { status: 400 });
  }

  try {
    const leadRef = db.collection("leads").doc(leadId);
    const studentRef = db.collection("students").doc(leadId); // deterministic
    const clientRef = db.collection("clients").doc(leadId); // deterministic
    const userRef = db.collection("users").doc(tutorUid); // where name/email/role lives

    const result = await db.runTransaction(async (tx) => {
      // 0) Load tutor profile (name)
      const userSnap = await tx.get(userRef);
      const tutorName =
        userSnap.exists && typeof userSnap.data()?.name === "string"
          ? (userSnap.data()!.name as string)
          : null;

      // 1) Load lead
      const leadSnap = await tx.get(leadRef);
      if (!leadSnap.exists) throw new Error("Lead not found.");

      const lead = leadSnap.data() as any;

      const status: LeadStatus = (lead.status as LeadStatus) || "new";
      const claimedTutorId: string | null = lead.claimedTutorId ?? null;

      if (status !== "new") throw new Error("This lead is not open anymore.");
      if (claimedTutorId) throw new Error("This lead has already been claimed.");

      // 2) Mark lead as claimed + also fill assignedTutor* for compatibility
      tx.update(leadRef, {
        status: "claimed",

        claimedTutorId: tutorUid,
        claimedTutorEmail: tutorEmail,
        claimedTutorName: tutorName,

        // compatibility fields (your existing tutor/student queries + rules)
        assignedTutorId: tutorUid,
        assignedTutorEmail: tutorEmail,
        assignedTutorName: tutorName,

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),

        // link ids (optional but handy)
        clientId: leadId,
        studentId: leadId,
      });

      // 3) Upsert client
      tx.set(
        clientRef,
        {
          parentName: lead.parentName ?? null,
          parentEmail: lead.parentEmail ?? null,
          parentPhone: lead.parentPhone ?? null,
          mode: lead.mode ?? null,
          suburb: lead.suburb ?? null,
          addressLine1: lead.addressLine1 ?? null,
          postcode: lead.postcode ?? null,
          package: lead.package ?? null,

          assignedTutorId: tutorUid,
          assignedTutorEmail: tutorEmail,
          assignedTutorName: tutorName,

          status: "active",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),

          // only set createdAt if not present
          createdAt:
            lead?.clientCreatedAt ?? admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Upsert student
      tx.set(
        studentRef,
        {
          clientId: leadId,

          studentName: lead.studentName ?? null,
          yearLevel: lead.yearLevel ?? null,
          school: lead.school ?? null,

          subjects: Array.isArray(lead.subjects) ? lead.subjects : [],
          mode: lead.mode ?? null,
          suburb: lead.suburb ?? null,
          addressLine1: lead.addressLine1 ?? null,
          postcode: lead.postcode ?? null,
          availabilityBlocks: Array.isArray(lead.availabilityBlocks) ? lead.availabilityBlocks : [],
          package: lead.package ?? null,

          goals: lead.goals ?? null,
          challenges: lead.challenges ?? null,

          assignedTutorId: tutorUid,
          assignedTutorEmail: tutorEmail,
          assignedTutorName: tutorName,

          tutorConfirmedAt: null,
          tutorConfirmedBy: null,

          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt:
            lead?.studentCreatedAt ?? admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { studentId: leadId };
    });

    return NextResponse.json({ ok: true, studentId: result.studentId }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/leads/[leadId]/claim] failed:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Claim failed." },
      { status: 400 }
    );
  }
}
