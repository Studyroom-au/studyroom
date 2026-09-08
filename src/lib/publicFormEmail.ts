// Shared transactional-email sender for the new Release 1C public forms
// (Hub early access, tutor applications). Reuses the exact Resend-then-SMTP
// pattern already used by /api/enquiry and /api/tutor/request-access —
// no new email provider introduced.
import nodemailer from "nodemailer";

function getSmtpTransporter() {
  const hasSmtp = !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  if (!hasSmtp) return null;

  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;

  if (resendKey && resendFrom) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
    if (res.ok) return;
    const errText = await res.text().catch(() => "");
    console.error("[publicFormEmail] Resend send failed:", res.status, errText);
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    throw new Error("No email provider configured.");
  }

  await transporter.sendMail({
    from: `"Studyroom" <${process.env.SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
