import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ADMIN_EMAILS = new Set(["lily.studyroom@gmail.com"]);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TUTOR-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const callerEmail = (decoded.email || "").toLowerCase();
    const isAdmin = decoded.role === "admin" || ALLOWED_ADMIN_EMAILS.has(callerEmail);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
    const tutorEmail = body.email?.trim().toLowerCase();
    if (!tutorEmail) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const tutorName = body.name?.trim() || "";
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.collection("tutorAccessCodes").add({
      code,
      tutorEmail,
      used: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    await db.collection("leads").add({
      type: "tutor_invite",
      email: tutorEmail,
      name: tutorName,
      status: "invited",
      accessCode: code,
      createdAt: FieldValue.serverTimestamp(),
    });

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT ?? 587),
          secure: Number(SMTP_PORT ?? 587) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        await transporter.sendMail({
          from: `"Studyroom" <${SMTP_USER}>`,
          to: tutorEmail,
          subject: "Welcome to Studyroom - your tutor access code",
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
      Welcome to the Studyroom tutor team.
    </h1>
    <p style="margin:0 0 20px;font-size:13px;color:#677a8a;line-height:1.6">
      You've been added as a tutor. Use the access code below to create
      your account at studyroom.au.
    </p>
  </td></tr>

  <tr><td style="padding:0 28px 20px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#f4f7f9;border-radius:12px">
      <tr><td style="padding:20px;text-align:center">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#748398">
          Your access code
        </p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#456071;letter-spacing:0.18em;font-family:monospace">
          ${code}
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#8a96a3">
          Valid for 48 hours
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 28px 20px">
    <p style="margin:0 0 12px;font-size:13px;color:#677a8a;line-height:1.6">
      To get started:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:4px 0;font-size:13px;color:#1d2428">
        1. Go to <a href="https://studyroom.au" style="color:#456071;font-weight:600">studyroom.au</a>
      </td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#1d2428">
        2. Click <strong>Tutor access</strong> tab
      </td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#1d2428">
        3. Select <strong>I have an access code</strong>
      </td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#1d2428">
        4. Enter your code, email address, and choose a password
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 28px 24px">
    <a href="https://studyroom.au"
      style="display:inline-block;background:#456071;color:#fff;text-decoration:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:600">
      Create my account -&gt;
    </a>
  </td></tr>

  <tr><td style="padding:14px 28px 20px;border-top:1px solid #f0f2f5">
    <p style="margin:0;font-size:11px;color:#b0bec5">
      Studyroom - Logan &amp; Brisbane Southside -
      <a href="mailto:contact.studyroomaustralia@gmail.com" style="color:#456071;text-decoration:none">contact.studyroomaustralia@gmail.com</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
        });
      } catch (emailErr) {
        console.warn("[grant-tutor] Email failed:", emailErr);
      }
    }

    return NextResponse.json({ ok: true, accessCode: code });
  } catch (err) {
    console.error("[grant-tutor]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
