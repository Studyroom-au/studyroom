import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Release 1B.1: "Confirm match and send tutor handover" — the ONLY trigger
// point for a structured handover packet + notification + (optional) email.
// Deliberately a SEPARATE, later, explicit admin action from assigning
// assignedTutorId — assignment itself is unchanged (existing Firestore
// read-access behaviour for an assigned tutor is untouched; see the
// founder's explicit decision to scope this patch to the notification/
// packet only, not to Firestore read-access architecture). This route only
// ever runs after: (1) an admin has already assigned a tutor, and (2) an
// admin explicitly clicks this action — i.e. the tutor has already
// accepted the proposed work off-platform, and admin is now confirming it.
//
// One handover document per student (doc ID == studentId) — a later
// re-assignment/re-confirmation overwrites it with the new tutor's packet.

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
    if (!token) return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }
    const actor = decoded.email || decoded.uid;

    const body = (await req.json().catch(() => ({}))) as {
      studentId?: string;
      commencementDate?: string | null;
      suggestedNextSteps?: string | null;
    };
    const studentId = String(body.studentId ?? "").trim();
    if (!studentId) return NextResponse.json({ error: "Missing studentId." }, { status: 400 });

    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const student = studentSnap.data() as Record<string, unknown>;

    const tutorId = String(student.assignedTutorId ?? "");
    if (!tutorId) {
      return NextResponse.json({ error: "This student has no assigned tutor yet — assign a tutor first." }, { status: 400 });
    }
    const tutorEmail = String(student.assignedTutorEmail ?? "") || null;

    const clientId = String(student.clientId ?? "");
    const clientSnap = clientId ? await db.collection("clients").doc(clientId).get() : null;
    const client = clientSnap?.exists ? (clientSnap.data() as Record<string, unknown>) : {};

    const [tutorUserSnap] = await Promise.all([db.collection("users").doc(tutorId).get()]);
    const tutorUser = tutorUserSnap.exists ? (tutorUserSnap.data() as Record<string, unknown>) : {};
    const tutorName = String(tutorUser.name ?? tutorUser.displayName ?? "") || null;

    const handoverRef = db.collection("tutorHandovers").doc(studentId);
    const handoverDoc = {
      studentId,
      clientId: clientId || null,
      tutorId,
      tutorEmail,
      tutorName,
      studentName: student.studentName ?? null,
      yearLevel: student.yearLevel ?? null,
      school: student.school ?? null,
      subjects: student.subjects ?? [],
      goals: student.goals ?? null,
      challenges: student.challenges ?? null,
      mode: student.mode ?? null,
      suburb: student.suburb ?? null,
      availabilityBlocks: student.availabilityBlocks ?? [],
      parentName: client.parentName ?? null,
      parentEmail: client.parentEmail ?? null,
      parentPhone: client.parentPhone ?? null,
      commencementDate: body.commencementDate || null,
      suggestedNextSteps: body.suggestedNextSteps || null,
      confirmedBy: actor,
      confirmedAt: FieldValue.serverTimestamp(),
      status: "pending",
      statusUpdatedBy: null,
      statusUpdatedAt: null,
      emailSent: false,
    };
    await handoverRef.set(handoverDoc, { merge: false });

    // Best-effort email — reuses the exact SMTP pattern already used by
    // /api/email/tutor-welcome; gracefully skips (never blocks/fails the
    // handover itself) if SMTP isn't configured.
    let emailSent = false;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (tutorEmail && SMTP_HOST && SMTP_USER && SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT ?? 587),
          secure: Number(SMTP_PORT ?? 587) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });
        await transporter.sendMail({
          from: `"Studyroom Australia" <${SMTP_USER}>`,
          to: tutorEmail,
          subject: `New student match confirmed: ${String(student.studentName ?? "a student")}`,
          html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1d2428;">
            <p>Hi${tutorName ? ` ${tutorName.split(" ")[0]}` : ""},</p>
            <p>You've been confirmed for a new student match: <strong>${String(student.studentName ?? "")}</strong>.</p>
            <p>Open your Tutor Portal to see the full handover details and next steps.</p>
            <p><a href="https://studyroom.au/hub/tutor" style="color:#456071;">Open Tutor Portal &rarr;</a></p>
          </body></html>`,
        });
        emailSent = true;
      } catch (e) {
        console.error("[tutors/handover/confirm] email send failed:", e);
      }
    }
    if (emailSent) {
      await handoverRef.set({ emailSent: true }, { merge: true });
    }

    return NextResponse.json({ ok: true, studentId, tutorId, emailSent });
  } catch (err: unknown) {
    console.error("[tutors/handover/confirm]", err);
    const message = err instanceof Error ? err.message : "Failed to confirm handover";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
