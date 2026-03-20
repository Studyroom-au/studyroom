import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const internalSecret = req.headers.get("x-internal-call");
    const isInternalCall =
      !!internalSecret &&
      internalSecret === (process.env.INTERNAL_API_SECRET ?? "studyroom-internal");

    if (!isInternalCall) {
      const adminAuth = getAdminAuth();
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace(/^Bearer\s+/i, "");
      if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const decoded = await adminAuth.verifyIdToken(token);
      const callerEmail = (decoded.email ?? "").toLowerCase();
      const isAdmin = callerEmail === "lily.studyroom@gmail.com" || decoded.role === "admin";
      if (!isAdmin) {
        const db = getAdminDb();
        const roleSnap = db ? await db.collection("roles").doc(decoded.uid).get() : null;
        const role = roleSnap?.exists ? String(roleSnap.data()?.role ?? "") : "";
        if (role !== "tutor" && role !== "admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string;
      tutorName?: string;
      tutorNotes?: string;
    };

    const { sessionId, tutorName, tutorNotes } = body;
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured");

    const sessionSnap = await db.collection("sessions").doc(sessionId).get();
    if (!sessionSnap.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const session = (sessionSnap.data() ?? {}) as {
      studentId?: string;
      clientId?: string;
      tutorId?: string;
      tutorEmail?: string;
      startAt?: { toDate: () => Date };
      durationMinutes?: number;
      modality?: string;
      notes?: string;
    };

    const studentId = String(session.studentId ?? "");
    const studentSnap = studentId
      ? await db.collection("students").doc(studentId).get()
      : null;
    const student = ((studentSnap?.data() ?? {}) as { studentName?: string; yearLevel?: string });
    const studentLabel = student.studentName
      ? `${student.studentName}${student.yearLevel ? ` · ${student.yearLevel}` : ""}`
      : "your student";

    const clientId = String(session.clientId ?? "");
    const clientSnap = clientId
      ? await db.collection("clients").doc(clientId).get()
      : null;
    const client = ((clientSnap?.data() ?? {}) as { parentName?: string; parentEmail?: string });

    const parentEmail = String(client.parentEmail ?? "");
    const parentFirstName = (client.parentName ?? "there").split(" ")[0];

    if (!parentEmail) {
      console.warn("[session-recap] No parent email for client:", clientId);
      return NextResponse.json({ ok: true, skipped: true, reason: "no parent email" });
    }

    const startAt = session.startAt?.toDate() ?? new Date();
    const duration = Number(session.durationMinutes ?? 60);
    const dateStr = startAt.toLocaleDateString("en-AU", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeStr = startAt.toLocaleTimeString("en-AU", {
      hour: "numeric", minute: "2-digit", hour12: true,
    });
    const modeStr = (session.modality ?? "").toUpperCase() === "ONLINE" ? "Online" : "In-home";
    const tutorDisplayName = tutorName || String(session.tutorEmail ?? "Your tutor");
    const sessionNotes = tutorNotes || session.notes || "";

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn("[session-recap] SMTP not configured — skipping");
      return NextResponse.json({ ok: true, skipped: true });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Studyroom" <${SMTP_USER}>`,
      to: parentEmail,
      subject: `Session recap — ${student.studentName ?? "your student"} · ${dateStr}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" border="0"
      style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

      <tr><td style="padding:32px 32px 0 32px;">
        <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#748398;">
          Studyroom &middot; Session Recap
        </p>
        <h1 style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:#1d2428;line-height:1.3;">
          Hi ${parentFirstName}, here&rsquo;s how today&rsquo;s session went.
        </h1>
        <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#677a8a;line-height:1.6;">
          ${tutorDisplayName} has just marked ${student.studentName ?? "the session"}&rsquo;s session as complete.
        </p>
      </td></tr>

      <tr><td style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#f4f7f9;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:20px 20px 16px 20px;">
            <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;color:#1d2428;">
              Session details
            </p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;width:90px;">Student</td>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2428;">${studentLabel}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;">Date</td>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2428;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;">Time</td>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2428;">${timeStr}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;">Duration</td>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2428;">${duration} minutes</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;">Mode</td>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2428;">${modeStr}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:600;color:#8a96a3;text-transform:uppercase;letter-spacing:0.06em;">Tutor</td>
                <td style="padding:4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2428;">${tutorDisplayName}</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      ${sessionNotes ? `
      <tr><td style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="border:1px solid rgba(69,96,113,0.15);border-left:3px solid #456071;border-radius:0 12px 12px 0;background:#f8fafc;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;color:#456071;text-transform:uppercase;letter-spacing:0.1em;">
              Tutor notes
            </p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2428;line-height:1.6;">
              ${sessionNotes.replace(/\n/g, "<br>")}
            </p>
          </td></tr>
        </table>
      </td></tr>
      ` : ""}

      <tr><td style="padding:0 32px 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="border:1px solid rgba(0,0,0,0.07);border-radius:12px;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#8a96a3;line-height:1.6;">
              Questions about this session? Reply to this email or contact
              <a href="mailto:contact.studyroomaustralia@gmail.com" style="color:#456071;text-decoration:none;">
                contact.studyroomaustralia@gmail.com
              </a>.
            </p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #f0f2f5;">
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;color:#b0bec5;">
          Studyroom &middot; Logan &amp; Brisbane Southside tutoring
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true, emailSent: true });
  } catch (err) {
    console.error("[session-recap] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
