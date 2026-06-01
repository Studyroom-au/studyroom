import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json() as {
      studentName?: string;
      yearLevel?: string;
      dob?: string;
      school?: string;
      subjects?: string[];
      parentName?: string;
      parentEmail?: string;
      parentPhone?: string;
      parentPassword?: string;
      referral?: string;
      loginEmail?: string;
    };

    const {
      studentName, yearLevel, dob, school, subjects,
      parentName, parentEmail, parentPhone, parentPassword, referral, loginEmail,
    } = body;

    if (!studentName?.trim()) return NextResponse.json({ error: "Student name is required." }, { status: 400 });
    if (!yearLevel) return NextResponse.json({ error: "Year level is required." }, { status: 400 });

    // parentEmail must come exclusively from the form — never fall back to the student's auth email
    const resolvedParentEmail = parentEmail?.trim() || null;
    // The student's own email comes from the verified token (authoritative) or loginEmail field
    const studentEmail = decoded.email ?? loginEmail?.trim() ?? null;

    const db = getAdminDb();

    const clientRef = db.collection("clients").doc();
    await clientRef.set({
      parentName: parentName?.trim() || null,
      parentEmail: resolvedParentEmail,
      parentPhone: parentPhone?.trim() || null,
      referral: referral || null,
      pricingPlan: "CASUAL",
      hubUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const studentRef = db.collection("students").doc();
    await studentRef.set({
      studentName: studentName.trim(),
      yearLevel,
      dob: dob || null,
      school: school?.trim() || null,
      subjects: subjects ?? [],
      clientId: clientRef.id,
      hubUid: uid,
      hubEmail: studentEmail,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("users").doc(uid).set({
      onboardingComplete: true,
      studentId: studentRef.id,
      clientId: clientRef.id,
      displayName: studentName.trim(),
      parentEmail: resolvedParentEmail,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Ensure student has a role doc
    await db.collection("roles").doc(uid).set({ role: "student" }, { merge: true });

    // Create parent Firebase Auth account (non-fatal if it fails)
    let parentAccountStatus: "created" | "existing" | "skipped" | "failed" = "skipped";
    const resolvedParentPassword = (parentPassword ?? "").trim();
    console.log("[onboarding] parentEmail provided:", Boolean(resolvedParentEmail));
    console.log("[onboarding] parentPassword provided:", Boolean(resolvedParentPassword));
    // Only attempt if we have a real parent email (not the student's own email) and a password
    if (resolvedParentEmail && resolvedParentEmail.toLowerCase() !== studentEmail?.toLowerCase() && resolvedParentPassword.length >= 6) {
      console.log("[onboarding] creating parent auth user:", resolvedParentEmail);
      try {
        const adminAuth = getAdminAuth();
        let parentUid: string | null = null;
        let accountWasNew = false;

        try {
          const newUser = await adminAuth.createUser({
            email: resolvedParentEmail.toLowerCase(),
            password: resolvedParentPassword,
            displayName: parentName?.trim() || undefined,
          });
          parentUid = newUser.uid;
          accountWasNew = true;
        } catch (createErr: unknown) {
          if ((createErr as { code?: string })?.code === "auth/email-already-exists") {
            const existing = await adminAuth.getUserByEmail(resolvedParentEmail.toLowerCase());
            parentUid = existing.uid;
            accountWasNew = false;
          } else {
            throw createErr;
          }
        }

        if (parentUid) {
          if (accountWasNew) {
            // Fresh account: write role and users doc
            await Promise.all([
              db.collection("roles").doc(parentUid).set({ role: "parent" }),
              db.collection("users").doc(parentUid).set({
                displayName: parentName?.trim() || null,
                parentOf: uid,
                role: "parent",
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              }),
            ]);
          } else {
            // Existing account: only set role if no role doc exists yet
            const existingRole = await db.collection("roles").doc(parentUid).get();
            if (!existingRole.exists) {
              await db.collection("roles").doc(parentUid).set({ role: "parent" });
            }
            // Always record parentOf so the link is established
            await db.collection("users").doc(parentUid).set({
              parentOf: uid,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
          }

          await clientRef.update({ parentUid });
        }

        parentAccountStatus = accountWasNew ? "created" : "existing";
      } catch (parentErr) {
        console.warn("[onboarding] Parent account creation failed:", parentErr);
        parentAccountStatus = "failed";
      }
    }

    // Send parent welcome email (non-fatal)
    try {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
      if (SMTP_HOST && SMTP_USER && SMTP_PASS && resolvedParentEmail) {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT ?? 587),
          secure: Number(SMTP_PORT ?? 587) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        const firstName = (parentName?.trim() || "there").split(" ")[0];
        const studentFirst = (studentName?.trim() || "your student").split(" ")[0];

        await transporter.sendMail({
          from: `"Studyroom" <${SMTP_USER}>`,
          to: resolvedParentEmail,
          subject: `Welcome to Studyroom — ${studentFirst} is all set up`,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8">
<tr><td align="center" style="padding:32px 16px">
<table width="520" cellpadding="0" cellspacing="0" border="0"
  style="max-width:520px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
  <tr><td style="padding:28px 28px 0">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#748398">
      Studyroom Australia
    </p>
    <h1 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#1d2428">
      Welcome, ${firstName}. ${studentFirst} is all set up.
    </h1>
    <p style="margin:0 0 20px;font-size:13px;color:#677a8a;line-height:1.6">
      Your account is active. We'll be in touch soon to match ${studentFirst} with the right tutor.
    </p>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#f4f7f9;border-radius:10px">
      <tr><td style="padding:14px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:3px 0;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;width:100px">Student</td>
            <td style="padding:3px 0;font-size:12px;color:#1d2428">${studentName?.trim() ?? ""}${yearLevel ? ` · ${yearLevel}` : ""}</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <a href="https://studyroom.au/hub"
      style="display:inline-block;background:#456071;color:#fff;text-decoration:none;border-radius:10px;padding:10px 22px;font-size:13px;font-weight:600">
      Open student hub →
    </a>
  </td></tr>
  <tr><td style="padding:14px 28px 20px;border-top:1px solid #f0f2f5">
    <p style="margin:0;font-size:11px;color:#b0bec5">
      Studyroom · Logan &amp; Brisbane Southside ·
      <a href="mailto:contact.studyroomaustralia@gmail.com" style="color:#456071;text-decoration:none">contact.studyroomaustralia@gmail.com</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
        });
      }
    } catch (emailErr) {
      console.warn("[onboarding] Welcome email failed:", emailErr);
    }

    // Update Stripe customer email (non-fatal)
    try {
      const userSnap = await db.collection("users").doc(uid).get();
      const stripeCustomerId = String(userSnap.data()?.stripeCustomerId ?? "");
      if (stripeCustomerId && resolvedParentEmail) {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: "2026-02-25.clover",
        });
        await stripe.customers.update(stripeCustomerId, {
          email: resolvedParentEmail.toLowerCase(),
          name: parentName?.trim() || undefined,
        });
      }
    } catch (stripeErr) {
      console.warn("[onboarding] Stripe update failed:", stripeErr);
    }

    return NextResponse.json({ ok: true, parentAccountStatus });
  } catch (err) {
    console.error("[onboarding/submit]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
