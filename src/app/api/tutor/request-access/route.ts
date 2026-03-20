import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { name, email } = await req.json() as { name?: string; email?: string };
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email required" }, { status: 400 });
    }

    // Save to Firestore leads collection
    const db = getAdminDb();
    if (db) {
      await db.collection("leads").add({
        type: "tutor_request",
        name: name.trim(),
        email: email.trim().toLowerCase(),
        status: "new",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Email admin
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT ?? 587),
        secure: Number(SMTP_PORT ?? 587) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      await transporter.sendMail({
        from: `"Studyroom" <${SMTP_USER}>`,
        to: "lily.studyroom@gmail.com",
        subject: `New tutor request — ${name.trim()}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8">
<tr><td align="center" style="padding:32px 16px">
<table width="480" cellpadding="0" cellspacing="0" border="0"
  style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="padding:28px 28px 0">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#748398">
      Studyroom &middot; Tutor request
    </p>
    <h1 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1d2428">
      New tutor request
    </h1>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:#f4f7f9;border-radius:10px">
      <tr><td style="padding:14px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:3px 0;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;width:80px">Name</td>
            <td style="padding:3px 0;font-size:13px;color:#1d2428">${name.trim()}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em">Email</td>
            <td style="padding:3px 0;font-size:13px;color:#456071">${email.trim()}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:16px 0 24px;font-size:13px;color:#677a8a;line-height:1.6">
      To add this tutor, go to the admin portal and add their email address.
      They will receive a welcome email with their access code.
    </p>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <a href="https://studyroom.au/hub/admin"
      style="display:inline-block;background:#456071;color:#fff;text-decoration:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600">
      Open admin portal &#8594;
    </a>
  </td></tr>
  <tr><td style="padding:14px 28px 20px;border-top:1px solid #f0f2f5">
    <p style="margin:0;font-size:11px;color:#b0bec5">Studyroom &middot; Logan &amp; Brisbane Southside</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tutor-request]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
