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

    // ── Role check (outside transaction so we can use queries) ───────────────
    const isAdminEmail = tutorEmail === "lily.studyroom@gmail.com";

    if (!isAdminEmail) {
      const roleSnap = await db.collection("roles").doc(tutorUid).get();
      let role: string | undefined = roleSnap.exists ? (roleSnap.data()?.role as string | undefined) : undefined;

      if (role !== "tutor") {
        // Fallback: if role doc is missing or wrong, check whether this user
        // redeemed a tutor access code — if so, grant the role now.
        const redeemedSnap = await db
          .collection("tutorAccessCodes")
          .where("redeemedByUid", "==", tutorUid)
          .limit(1)
          .get();

        if (!redeemedSnap.empty) {
          await db.collection("roles").doc(tutorUid).set(
            { role: "tutor" },
            { merge: true }
          );
          role = "tutor";
        }
      }

      if (role !== "tutor") {
        if (!roleSnap.exists) {
          return NextResponse.json(
            { ok: false, error: "Your tutor role has not been set up yet. Please contact admin." },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { ok: false, error: "Only tutors can claim leads." },
          { status: 403 }
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const leadRef = db.collection("leads").doc(leadId);
    const studentRef = db.collection("students").doc(leadId);
    const clientRef = db.collection("clients").doc(leadId);
    const userRef = db.collection("users").doc(tutorUid);

    const result = await db.runTransaction(async (tx) => {
      const [userSnap, leadSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(leadRef),
      ]);

      const tutorName =
        userSnap.exists && typeof userSnap.data()?.name === "string"
          ? (userSnap.data()!.name as string)
          : null;

      if (!leadSnap.exists) throw new Error("Lead not found.");

      const lead = leadSnap.data() as Record<string, unknown>;

      const status: LeadStatus = (lead.status as LeadStatus) || "new";
      const claimedTutorId = (lead.claimedTutorId as string | null) ?? null;

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
          parentName: (lead.parentName as string | null) ?? null,
          parentEmail: (lead.parentEmail as string | null) ?? null,
          parentPhone: (lead.parentPhone as string | null) ?? null,

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

          studentName: (lead.studentName as string | null) ?? null,
          yearLevel: (lead.yearLevel as string | null) ?? null,
          school: (lead.school as string | null) ?? null,

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

  } catch (err: unknown) {
    console.error("[claim] failed:", err);
    const message = err instanceof Error ? err.message : "Claim failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
