import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAdminAuth } from "@/lib/firebaseAdmin";

const ALLOWED_ADMIN_EMAILS = new Set(["lily.studyroom@gmail.com"]);

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();

    // Verify admin caller
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const callerEmail = (decoded.email || "").toLowerCase();
    const isAdmin = decoded.role === "admin" || ALLOWED_ADMIN_EMAILS.has(callerEmail);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { to?: string; displayName?: string; accessCode?: string };
    const { to, displayName = "there", accessCode } = body;
    if (!to) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const firstName = displayName.split(" ")[0] || displayName;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn("[tutor-welcome] SMTP not configured — skipping email");
      return NextResponse.json({ ok: true, skipped: true });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Studyroom Australia" <${SMTP_USER}>`,
      to,
      subject: "Welcome to Studyroom — you've been added as a tutor",
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table width="560" cellpadding="0" cellspacing="0" border="0"
        style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 32px 0 32px;">
            <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#748398;">
              Studyroom Australia
            </p>
            <h1 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:700;color:#1d2428;line-height:1.3;">
              Hi ${firstName}, you're now a tutor on Studyroom.
            </h1>
            <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;color:#677a8a;line-height:1.6;">
              Your account has been upgraded to tutor access. Here's how to get started.
            </p>
          </td>
        </tr>

        <!-- Access code card -->
        ${accessCode ? `
        <tr>
          <td style="padding:0 32px 20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:#edf2f6;border-radius:12px;">
              <tr>
                <td style="padding:16px 20px;text-align:center;">
                  <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;color:#456071;text-transform:uppercase;letter-spacing:0.14em;">
                    Your access code
                  </p>
                  <p style="margin:0 0 6px;font-family:monospace,monospace;font-size:22px;font-weight:700;color:#1d2428;letter-spacing:0.18em;">
                    ${accessCode}
                  </p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;color:#8a96a3;">
                    Valid for 48 hours. Use this when signing up at studyroom.au
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ` : ""}

        <!-- Steps card -->
        <tr>
          <td style="padding:0 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:#f4f7f9;border-radius:12px;overflow:hidden;">

              <tr>
                <td style="padding:20px 20px 8px 20px;">
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;color:#1d2428;">
                    Your next steps
                  </p>
                </td>
              </tr>

              <!-- Step 1 -->
              <tr>
                <td style="padding:10px 20px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="30" valign="top" style="padding-top:1px;">
                        <div style="width:22px;height:22px;border-radius:50%;background:#456071;text-align:center;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#ffffff;line-height:22px;">
                          1
                        </div>
                      </td>
                      <td style="padding-left:10px;">
                        <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;color:#1d2428;">
                          Sign in to the Tutor Portal
                        </p>
                        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a96a3;line-height:1.5;">
                          Head to <a href="https://studyroom.au/hub/tutor" style="color:#456071;text-decoration:none;">studyroom.au/hub/tutor</a> and sign in with this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Step 2 -->
              <tr>
                <td style="padding:10px 20px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="30" valign="top" style="padding-top:1px;">
                        <div style="width:22px;height:22px;border-radius:50%;background:#456071;text-align:center;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#ffffff;line-height:22px;">
                          2
                        </div>
                      </td>
                      <td style="padding-left:10px;">
                        <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;color:#1d2428;">
                          Check your students
                        </p>
                        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a96a3;line-height:1.5;">
                          If you've been assigned students, find them under <strong style="color:#1d2428;">My Students</strong> and add sessions to your calendar.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Step 3 -->
              <tr>
                <td style="padding:10px 20px 20px 20px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="30" valign="top" style="padding-top:1px;">
                        <div style="width:22px;height:22px;border-radius:50%;background:#456071;text-align:center;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#ffffff;line-height:22px;">
                          3
                        </div>
                      </td>
                      <td style="padding-left:10px;">
                        <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;color:#1d2428;">
                          Browse the leads marketplace
                        </p>
                        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a96a3;line-height:1.5;">
                          New student enquiries appear in the <strong style="color:#1d2428;">Marketplace</strong> tab as families enrol.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Contact note -->
        <tr>
          <td style="padding:0 32px 24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="border:1px solid rgba(0,0,0,0.07);border-radius:12px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a96a3;line-height:1.6;">
                    Questions? Reply to this email or contact
                    <a href="mailto:contact.studyroomaustralia@gmail.com" style="color:#456071;text-decoration:none;">
                      contact.studyroomaustralia@gmail.com
                    </a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA button -->
        <tr>
          <td style="padding:0 32px 32px 32px;">
            <a href="https://studyroom.au/hub/tutor"
              style="display:inline-block;background:#456071;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;">
              Open Tutor Portal &#8594;
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px 32px;border-top:1px solid #f0f2f5;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;color:#b0bec5;">
              Studyroom &middot; Logan &amp; Brisbane Southside tutoring
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true, emailSent: true });
  } catch (err) {
    console.error("[tutor-welcome] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
