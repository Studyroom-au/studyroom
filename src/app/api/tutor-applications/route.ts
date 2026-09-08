import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminApp } from "@/lib/firebaseAdmin";
import { cleanStr, isValidEmail, cleanAttribution, isHoneypotTripped } from "@/lib/publicFormValidation";
import { sendTransactionalEmail } from "@/lib/publicFormEmail";
import { escapeHtml } from "@/lib/escapeHtml";
import { MODE_OPTIONS, BLUE_CARD_STATUS_OPTIONS, ABN_STATUS_OPTIONS } from "@/lib/studyroom/tutorApplicationFields";

// Public, pre-account tutor recruitment intake ("Apply to tutor with
// Studyroom"). Writes only to `tutorApplications` via the Admin SDK.
// Deliberately does NOT touch tutorAccessRequest, tutors/{uid}, roles, or
// Firebase Auth — those are separate, authenticated systems that only come
// into play later, during actual onboarding. See Release 1C Phase 1/2 notes.

const MODE_VALUES = MODE_OPTIONS.map((o) => o.value) as readonly string[];
const BLUE_CARD_VALUES = BLUE_CARD_STATUS_OPTIONS.map((o) => o.value) as readonly string[];
const ABN_VALUES = ABN_STATUS_OPTIONS.map((o) => o.value) as readonly string[];

const RESUME_EMAIL = "contact.studyroomaustralia@gmail.com";

type Body = Record<string, unknown>;

function cleanBool(v: unknown): boolean {
  return v === true;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (isHoneypotTripped(body)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const fullName = cleanStr(body.fullName, 120);
  const email = cleanStr(body.email, 200).toLowerCase();
  const phoneDigits = cleanStr(body.phone, 40);
  const suburb = cleanStr(body.suburb, 120);
  const mode = cleanStr(body.mode, 20);
  const willingInHome = cleanBool(body.willingInHome);
  const hasCar = cleanBool(body.hasCar);
  const licenceStatus = cleanStr(body.licenceStatus, 200) || null;
  const serviceAreas = cleanStr(body.serviceAreas, 400) || null;
  const subjects = cleanStr(body.subjects, 300);
  const yearLevelsComfortable = cleanStr(body.yearLevelsComfortable, 200);
  const background = cleanStr(body.background, 1000) || null;
  const experience = cleanStr(body.experience, 1000) || null;
  const availability = cleanStr(body.availability, 400) || null;
  const blueCardStatus = cleanStr(body.blueCardStatus, 30);
  const abnStatus = cleanStr(body.abnStatus, 30);
  const whyTutor = cleanStr(body.whyTutor, 1500);
  const referralSource = cleanStr(body.referralSource, 200) || null;
  const attribution = cleanAttribution(body);

  if (fullName.length < 2) {
    return NextResponse.json({ ok: false, error: "Full name is required." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  if (phoneDigits.replace(/\D/g, "").length < 6) {
    return NextResponse.json({ ok: false, error: "A valid phone number is required." }, { status: 400 });
  }
  if (suburb.length < 2) {
    return NextResponse.json({ ok: false, error: "Suburb/location is required." }, { status: 400 });
  }
  if (!MODE_VALUES.includes(mode)) {
    return NextResponse.json({ ok: false, error: "Please select in-home, online, or both." }, { status: 400 });
  }
  if (subjects.length < 2) {
    return NextResponse.json({ ok: false, error: "Please list at least one subject." }, { status: 400 });
  }
  if (yearLevelsComfortable.length < 2) {
    return NextResponse.json({ ok: false, error: "Please list the year levels you're comfortable tutoring." }, { status: 400 });
  }
  if (!BLUE_CARD_VALUES.includes(blueCardStatus)) {
    return NextResponse.json({ ok: false, error: "Please select your Blue Card status." }, { status: 400 });
  }
  if (!ABN_VALUES.includes(abnStatus)) {
    return NextResponse.json({ ok: false, error: "Please select your ABN status." }, { status: 400 });
  }
  if (whyTutor.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Please tell us a little about why you'd like to tutor with Studyroom." },
      { status: 400 }
    );
  }

  try {
    const app = getAdminApp();
    const db = admin.firestore(app);

    await db.collection("tutorApplications").add({
      fullName,
      email,
      phone: phoneDigits,
      suburb,
      mode,
      willingInHome,
      hasCar,
      licenceStatus,
      serviceAreas,
      subjects,
      yearLevelsComfortable,
      background,
      experience,
      availability,
      blueCardStatus,
      abnStatus,
      whyTutor,
      referralSource,
      // Server-controlled — never trust these (or anything else) from the client body.
      reviewStatus: "new",
      source: "tutor_application",
      referrer: attribution.referrer,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Both emails are best-effort — the application is already recorded and
    // will show up in New Applications regardless of delivery outcome.
    try {
      await sendTransactionalEmail({
        to: email,
        subject: "Thanks for applying to tutor with Studyroom",
        text: `Thanks for applying to tutor with Studyroom. We've received your application.\n\nPlease email your resume to ${RESUME_EMAIL}. You're also welcome to include a short cover letter if you'd like to tell us anything else about yourself.\n\nOnce we've received your resume, we'll review your application and contact you about next steps.\n\nWarmly,\nStudyroom Australia`,
        html: `<div style="font-family:Arial,sans-serif;color:#1d2428;line-height:1.6;"><p>Thanks for applying to tutor with Studyroom. We've received your application.</p><p>Please email your resume to <a href="mailto:${RESUME_EMAIL}" style="color:#456071;font-weight:700;">${RESUME_EMAIL}</a>. You're also welcome to include a short cover letter if you'd like to tell us anything else about yourself.</p><p>Once we've received your resume, we'll review your application and contact you about next steps.</p><p style="margin-top:18px;">Warmly,<br/><strong>Studyroom Australia</strong></p></div>`,
      });
    } catch (mailErr) {
      console.error("[/api/tutor-applications] applicant confirmation failed (non-fatal):", mailErr);
    }

    const mailTo = process.env.TUTOR_APPLICATION_ALERT_TO || process.env.MAIL_TO || RESUME_EMAIL;
    try {
      // Plain-text body: no escaping needed. HTML body: every submitted value
      // must be escaped before interpolation so it can't become active markup.
      const safeFullName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      const safePhone = escapeHtml(phoneDigits);
      const safeSuburb = escapeHtml(suburb);
      const safeMode = escapeHtml(mode);
      const safeSubjects = escapeHtml(subjects);
      const safeYearLevels = escapeHtml(yearLevelsComfortable);
      const safeBlueCard = escapeHtml(blueCardStatus);
      const safeAbn = escapeHtml(abnStatus);

      await sendTransactionalEmail({
        to: mailTo,
        subject: `New tutor application — ${fullName}`,
        text: `New tutor application\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phoneDigits}\nSuburb: ${suburb}\nMode: ${mode}\nWilling in-home: ${willingInHome ? "Yes" : "No"}\nHas car: ${hasCar ? "Yes" : "No"}\nSubjects: ${subjects}\nYear levels: ${yearLevelsComfortable}\nBlue Card: ${blueCardStatus}\nABN: ${abnStatus}\n\nReview in the admin portal: https://studyroom.au/hub/admin/tutors`,
        html: `<div style="font-family:Arial,sans-serif;color:#1d2428;line-height:1.6;"><p><strong>New tutor application</strong></p><p>Name: ${safeFullName}<br/>Email: ${safeEmail}<br/>Phone: ${safePhone}<br/>Suburb: ${safeSuburb}<br/>Mode: ${safeMode}<br/>Willing in-home: ${willingInHome ? "Yes" : "No"}<br/>Has car: ${hasCar ? "Yes" : "No"}<br/>Subjects: ${safeSubjects}<br/>Year levels: ${safeYearLevels}<br/>Blue Card: ${safeBlueCard}<br/>ABN: ${safeAbn}</p><p><a href="https://studyroom.au/hub/admin/tutors" style="display:inline-block;background:#456071;color:#fff;text-decoration:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;">Review in admin portal &#8594;</a></p></div>`,
      });
    } catch (mailErr) {
      console.error("[/api/tutor-applications] admin notify failed (non-fatal):", mailErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[/api/tutor-applications] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
