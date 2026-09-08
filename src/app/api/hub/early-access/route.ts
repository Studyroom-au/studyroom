import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminApp } from "@/lib/firebaseAdmin";
import { cleanStr, isValidEmail, cleanAttribution, isHoneypotTripped } from "@/lib/publicFormValidation";
import { sendTransactionalEmail } from "@/lib/publicFormEmail";
import { escapeHtml } from "@/lib/escapeHtml";
import { YEAR_LEVELS } from "@/lib/studyroom/enrolmentFields";

// Public, pre-account expression of interest in standalone Hub access (demand
// validation only). Writes only to `hubEarlyAccess` via the Admin SDK — never
// `leads` (see firestore.rules comment), and never creates a Firebase Auth
// user, role, or subscription. See Release 1C Phase 1/2 notes.

type Body = Record<string, unknown>;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  // Silent bot rejection — looks like success to whatever filled the trap.
  if (isHoneypotTripped(body)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const name = cleanStr(body.name, 120);
  const email = cleanStr(body.email, 200).toLowerCase();
  const studentYearLevel = cleanStr(body.studentYearLevel, 40);
  const biggestStudyChallenge = cleanStr(body.biggestStudyChallenge, 1000) || null;
  const guardianAcknowledgement = body.guardianAcknowledgement === true;
  const attribution = cleanAttribution(body);

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  if (!(YEAR_LEVELS as readonly string[]).includes(studentYearLevel)) {
    return NextResponse.json({ ok: false, error: "Please select a year level." }, { status: 400 });
  }
  if (!guardianAcknowledgement) {
    return NextResponse.json(
      { ok: false, error: "Please confirm the acknowledgement before submitting." },
      { status: 400 }
    );
  }

  try {
    const app = getAdminApp();
    const db = admin.firestore(app);

    await db.collection("hubEarlyAccess").add({
      name,
      email,
      studentYearLevel,
      biggestStudyChallenge,
      guardianAcknowledgement: true,
      // Server-controlled — never trust these from the client body.
      source: "hub_early_access",
      referrer: attribution.referrer,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Best-effort admin notification — the submission is already recorded and
    // visible in the admin list regardless of whether this email goes out.
    const mailTo =
      process.env.HUB_EARLY_ACCESS_ALERT_TO || process.env.MAIL_TO || "contact.studyroomaustralia@gmail.com";
    try {
      // Plain-text body: no escaping needed. HTML body: every submitted value
      // must be escaped before interpolation so it can't become active markup.
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeYearLevel = escapeHtml(studentYearLevel);
      const safeChallenge = escapeHtml(biggestStudyChallenge || "(not provided)");
      const safeUtmSource = escapeHtml(attribution.utm_source || "-");
      const safeUtmMedium = escapeHtml(attribution.utm_medium || "-");
      const safeUtmCampaign = escapeHtml(attribution.utm_campaign || "-");
      const safeReferrer = escapeHtml(attribution.referrer || "-");

      await sendTransactionalEmail({
        to: mailTo,
        subject: `New Hub early-access interest — ${name}`,
        text: `New Hub early-access submission\n\nName: ${name}\nEmail: ${email}\nYear level: ${studentYearLevel}\nBiggest study challenge: ${biggestStudyChallenge || "(not provided)"}\n\nSource: hub_early_access\nUTM source: ${attribution.utm_source || "(none)"}\nUTM medium: ${attribution.utm_medium || "(none)"}\nUTM campaign: ${attribution.utm_campaign || "(none)"}\nReferrer: ${attribution.referrer || "(none)"}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1d2428;line-height:1.6;"><p><strong>New Hub early-access submission</strong></p><p>Name: ${safeName}<br/>Email: ${safeEmail}<br/>Year level: ${safeYearLevel}<br/>Biggest study challenge: ${safeChallenge}</p><p style="color:#748398;font-size:12px;">Source: hub_early_access<br/>UTM: ${safeUtmSource} / ${safeUtmMedium} / ${safeUtmCampaign}<br/>Referrer: ${safeReferrer}</p></div>`,
      });
    } catch (mailErr) {
      console.error("[/api/hub/early-access] admin notify failed (non-fatal):", mailErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[/api/hub/early-access] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
