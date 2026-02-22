import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import nodemailer from "nodemailer";
import { getAdminApp } from "@/lib/firebaseAdmin";

type EnquiryPayload = {
  name?: string;
  email?: string;
  message?: string;
};

function cleanStr(s: unknown, max = 2000) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function isEmail(s: string) {
  return typeof s === "string" && s.includes("@") && s.length <= 200;
}

async function sendAutoReplyEmail(opts: {
  to: string;
  parentName: string;
}) {
  const enrolUrl = "https://studyroom.au/enrol";

  // Recommended: Resend (simple + reliable)
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM; // e.g. "Studyroom <hello@studyroom.au>"

  if (!resendKey || !from) {
    console.warn("[/api/enquiry] RESEND_API_KEY or RESEND_FROM missing — skipping email send.");
    return;
  }

  const subject = "Thanks for reaching out to Studyroom 🌿";

  const text = `Hi ${opts.parentName || "there"},

Thank you for getting in touch with Studyroom.

To help us match your child with the right tutor, please complete our enrolment form here:
${enrolUrl}

Once we receive it, we’ll personally review your enquiry and respond within 1–3 business days.

Warmly,
Lily
Founder, Studyroom Australia`;

  // Minimal HTML (safe + clean)
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1b1b1b;">
      <p>Hi ${opts.parentName || "there"},</p>
      <p>Thank you for getting in touch with <strong>Studyroom</strong>.</p>
      <p>
        To help us match your child with the right tutor, please complete our enrolment form here:
        <br/>
        <a href="${enrolUrl}" style="color: #1f6f5b; font-weight: 700;">${enrolUrl}</a>
      </p>
      <p>
        Once we receive it, we’ll personally review your enquiry and respond within <strong>1–3 business days</strong>.
      </p>
      <p style="margin-top: 18px;">
        Warmly,<br/>
        <strong>Lily</strong><br/>
        Founder, Studyroom Australia
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
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
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[/api/enquiry] Resend error:", res.status, errText);
  }
}

async function sendInternalEnquiryAlert(opts: { name: string; email: string; message: string }) {
  const mailTo =
    process.env.ENQUIRY_ALERT_TO ||
    process.env.MAIL_TO ||
    "contactstudyroomaustralia@gmail.com";

  const subject = "New enquiry from Studyroom website";
  const text = `New Studyroom enquiry

Name: ${opts.name}
Email: ${opts.email}

Message:
${opts.message}`;

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  if (resendKey && resendFrom) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: mailTo,
        subject,
        text,
        html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">${text}</pre>`,
      }),
    });

    if (r.ok) return;
    const errText = await r.text().catch(() => "");
    console.error("[/api/enquiry] internal alert via Resend failed:", r.status, errText);
  }

  const hasSmtp =
    !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  if (!hasSmtp) {
    console.warn("[/api/enquiry] No Resend/SMTP config for internal enquiry alert.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Studyroom Website" <${process.env.SMTP_USER}>`,
    to: mailTo,
    subject,
    text,
    html: text.replace(/\n/g, "<br />"),
  });
}

export async function POST(req: Request) {
  const app = getAdminApp();
  if (!app) {
    return NextResponse.json(
      { ok: false, error: "Server is not configured for enquiries yet." },
      { status: 500 }
    );
  }

  const db = admin.firestore(app);

  let body: EnquiryPayload;
  try {
    body = (await req.json()) as EnquiryPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const name = cleanStr(body.name, 120);
  const email = cleanStr(body.email, 200).toLowerCase();
  const message = cleanStr(body.message, 4000);

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ ok: false, error: "Please write a short message." }, { status: 400 });
  }

  try {
    await db.collection("enquiries").add({
      name,
      email,
      message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Internal alert should include full enquiry contents.
    try {
      await sendInternalEnquiryAlert({ name, email, message });
    } catch (mailErr) {
      console.error("[/api/enquiry] internal alert failed (non-fatal):", mailErr);
    }

    // Auto reply with enrol link + timeframe.
    try {
      await sendAutoReplyEmail({ to: email, parentName: name });
    } catch (mailErr) {
      console.error("[/api/enquiry] auto-reply failed (non-fatal):", mailErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[/api/enquiry] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to submit enquiry. Please try again." },
      { status: 500 }
    );
  }
}
