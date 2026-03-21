import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Called by Vercel Cron once per day (see vercel.json)
export async function GET(req: NextRequest) {
  // Vercel sends its own cron secret automatically
  const cronSecret = process.env.CRON_SECRET;
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const authHeader = req.headers.get("authorization");

  if (
    authHeader !== `Bearer ${cronSecret}` &&
    authHeader !== `Bearer ${internalSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) throw new Error("DB not configured");

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Find trial users who haven't been warned yet
  const snap = await db
    .collection("users")
    .where("subscriptionStatus", "==", "trial")
    .where("trialWarningEmailSent", "==", false)
    .get();

  // Filter to those expiring in the next 24-48 hours
  const expiringSoon = snap.docs.filter(d => {
    const trialEndsAt = d.data().trialEndsAt?.toDate?.();
    if (!trialEndsAt) return false;
    return trialEndsAt >= in24h && trialEndsAt <= in48h;
  });

  if (expiringSoon.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 500 });
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  let sent = 0;

  for (const userDoc of expiringSoon) {
    const data = userDoc.data();
    const email = data.parentEmail || data.email;
    if (!email) continue;

    const trialEndsAt = data.trialEndsAt?.toDate?.();
    const endsText = trialEndsAt
      ? trialEndsAt.toLocaleDateString("en-AU", {
          weekday: "long", day: "numeric", month: "long",
        })
      : "tomorrow";

    try {
      await transporter.sendMail({
        from: `"Studyroom" <${SMTP_USER}>`,
        to: email,
        subject: "Your Studyroom trial ends tomorrow",
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
    <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1d2428">
      Your free trial ends ${endsText}.
    </h1>
    <p style="margin:0 0 20px;font-size:13px;color:#677a8a;line-height:1.6">
      Your 7-day trial access to Studyroom expires ${endsText}. Subscribe now to keep
      access to your student hub, session history, and tutor tools.
    </p>
  </td></tr>
  <tr><td style="padding:0 28px 20px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#f4f7f9;border-radius:12px">
      <tr><td style="padding:16px 18px;text-align:center">
        <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#456071">$9.95</p>
        <p style="margin:0;font-size:12px;color:#8a96a3">per month · cancel anytime</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <a href="https://studyroom.au/subscribe"
      style="display:inline-block;background:#456071;color:#fff;text-decoration:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:600">
      Subscribe now →
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

      await userDoc.ref.update({
        trialWarningEmailSent: true,
        trialWarningEmailSentAt: FieldValue.serverTimestamp(),
      });

      sent++;
    } catch (emailErr) {
      console.error("[trial-warnings] Email failed for", email, emailErr);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
