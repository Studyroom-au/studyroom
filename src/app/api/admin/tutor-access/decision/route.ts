import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ADMIN_EMAILS = new Set(["lily.studyroom@gmail.com"]);

type Decision = "approve" | "reject";

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

async function sendTutorDecisionEmail(opts: {
  to: string;
  decision: Decision;
  reason?: string | null;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!resendKey || !from) return;

  const approved = opts.decision === "approve";
  const subject = approved
    ? "Studyroom Tutor Access Approved"
    : "Studyroom Tutor Access Update";

  const reasonLine = opts.reason ? `\nReason: ${opts.reason}` : "";
  const text = approved
    ? "Your tutor application has been approved. You can now access the Tutor Portal."
    : `Your tutor application was not approved at this stage.${reasonLine}\n\nYou can update your application and resubmit from Tutor Portal.`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;color:#1b1b1b;line-height:1.5;"><p>${text.replace(
        /\n/g,
        "<br/>"
      )}</p></div>`,
    }),
  });
}

function hasCompleteApplication(req: Record<string, unknown>) {
  const app = (req.application as Record<string, unknown> | undefined) || {};
  const subjects = Array.isArray(app.subjects) ? app.subjects.filter((x) => typeof x === "string" && x.trim()) : [];
  const yearLevels = Array.isArray(app.yearLevels)
    ? app.yearLevels.filter((x) => typeof x === "string" && x.trim())
    : [];
  const modes = Array.isArray(app.modes)
    ? app.modes.filter((x) => x === "ONLINE" || x === "IN_HOME")
    : [];
  const serviceArea = typeof app.serviceArea === "string" ? app.serviceArea.trim() : "";
  const abn = typeof app.abn === "string" ? app.abn.trim() : "";
  const wwccStatus = typeof app.wwccStatus === "string" ? app.wwccStatus.trim() : "";
  return (
    subjects.length > 0 &&
    yearLevels.length > 0 &&
    modes.length > 0 &&
    !!serviceArea &&
    !!abn &&
    !!wwccStatus
  );
}

export async function POST(req: Request) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      targetUid?: string;
      decision?: Decision;
      reason?: string | null;
    };

    const actorToken = readBearerToken(req);
    if (!actorToken) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(actorToken);
    const actorEmail = (decoded.email || "").toLowerCase();
    const isAdmin = decoded.role === "admin" || ALLOWED_ADMIN_EMAILS.has(actorEmail);
    if (!isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const targetUid = String(body.targetUid || "").trim();
    const decision = body.decision;
    const reason = String(body.reason || "").trim();
    if (!targetUid || (decision !== "approve" && decision !== "reject")) {
      return NextResponse.json({ error: "Missing or invalid targetUid/decision." }, { status: 400 });
    }
    if (decision === "reject" && !reason) {
      return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
    }

    const targetUserRecord = await adminAuth.getUser(targetUid).catch(() => null);
    const targetEmail = targetUserRecord?.email || "";

    const userRef = db.collection("users").doc(targetUid);
    const roleRef = db.collection("roles").doc(targetUid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
    const existingReq =
      (userData?.tutorAccessRequest as Record<string, unknown> | undefined) || {};

    const nextRole = decision === "approve" ? "tutor" : "tutor_pending";
    if (decision === "approve" && !hasCompleteApplication(existingReq)) {
      return NextResponse.json(
        { error: "Cannot approve: tutor application is incomplete." },
        { status: 400 }
      );
    }
    await adminAuth.setCustomUserClaims(targetUid, { role: nextRole });

    const batch = db.batch();
    batch.set(
      roleRef,
      { role: nextRole, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    batch.set(
      userRef,
      {
        role: nextRole,
        tutorAccessRequest: {
          ...existingReq,
          status: decision === "approve" ? "approved" : "rejected",
          decisionReason: decision === "reject" ? reason : null,
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedByEmail: actorEmail,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    let emailSent = false;
    if (targetEmail) {
      try {
        await sendTutorDecisionEmail({
          to: targetEmail,
          decision,
          reason: reason || null,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error("[admin/tutor-access/decision] email failed (non-fatal):", mailErr);
      }
    }

    return NextResponse.json({ ok: true, targetUid, decision, emailSent });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to process tutor decision";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
