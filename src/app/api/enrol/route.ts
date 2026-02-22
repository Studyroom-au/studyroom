import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import nodemailer from "nodemailer";
import { getAdminApp } from "@/lib/firebaseAdmin";

type PackagePlan = "CASUAL" | "PACKAGE_5" | "PACKAGE_12";

type EnrolPayload = {
  parentName: string;
  parentEmail: string;
  parentPhone: string;

  studentName: string;
  yearLevel: string;
  school?: string;

  subjects: string[];

  mode: "online" | "in-home";

  suburb?: string;
  addressLine1?: string;
  postcode?: string;

  availabilityBlocks: string[];

  goals?: string;
  challenges?: string;

  package: PackagePlan;

  consent: boolean;
  source?: "direct-enrol" | "contact";
};

function isEmail(s: string) {
  return typeof s === "string" && s.includes("@") && s.length <= 200;
}

function cleanStr(s: unknown, max = 500) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function cleanStrArray(v: unknown, maxItems: number, maxLen: number) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => cleanStr(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isPackagePlan(v: unknown): v is PackagePlan {
  return v === "CASUAL" || v === "PACKAGE_5" || v === "PACKAGE_12";
}

function packageLabel(p: PackagePlan) {
  if (p === "PACKAGE_5") return "5-session package";
  if (p === "PACKAGE_12") return "12-session package";
  return "Casual sessions";
}

async function sendEnrolmentAlert(opts: {
  leadId: string;
  source: "direct-enrol" | "contact";
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  yearLevel: string;
  school: string;
  subjects: string[];
  mode: "online" | "in-home";
  suburb: string;
  addressLine1: string;
  postcode: string;
  pkg: PackagePlan;
  availabilityBlocks: string[];
  goals: string;
  challenges: string;
}) {
  const mailTo =
    process.env.ENROL_ALERT_TO ||
    process.env.MAIL_TO ||
    "contactstudyroomaustralia@gmail.com";

  const textBody = `
New Studyroom enrolment

Lead ID: ${opts.leadId}
Source: ${opts.source}

Parent name: ${opts.parentName}
Email: ${opts.parentEmail}
Phone: ${opts.parentPhone}

Student name: ${opts.studentName}
Year level: ${opts.yearLevel}
School: ${opts.school || "Not provided"}

Subjects: ${opts.subjects.join(", ")}

Mode: ${opts.mode === "in-home" ? "In-home" : "Online"}
Suburb: ${opts.suburb || "Not provided"}
Address line: ${opts.addressLine1 || "Not provided"}
Postcode: ${opts.postcode || "Not provided"}

Package: ${packageLabel(opts.pkg)}

Availability:
- ${opts.availabilityBlocks.join("\n- ")}

Goals:
${opts.goals || "-"}

Challenges:
${opts.challenges || "-"}
`;

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
        subject: "New enrolment from Studyroom website",
        text: textBody,
        html: textBody.replace(/\n/g, "<br />"),
      }),
    });

    if (r.ok) return;
    const errText = await r.text().catch(() => "");
    console.error("[/api/enrol] Resend alert failed:", r.status, errText);
  }

  const hasSmtp =
    !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  if (!hasSmtp) {
    console.warn("[/api/enrol] No Resend/SMTP config for enrolment alert.");
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
    subject: "New enrolment from Studyroom website",
    text: textBody,
    html: textBody.replace(/\n/g, "<br />"),
  });
}

export async function POST(req: Request) {
  const app = getAdminApp();
  if (!app) {
    return NextResponse.json(
      { ok: false, error: "Server is not configured for enrolment submissions yet." },
      { status: 500 }
    );
  }

  const db = admin.firestore(app);

  let body: EnrolPayload;
  try {
    body = (await req.json()) as EnrolPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parentName = cleanStr(body.parentName, 120);
  const parentEmail = cleanStr(body.parentEmail, 200).toLowerCase();
  const parentPhone = cleanStr(body.parentPhone, 50);

  const studentName = cleanStr(body.studentName, 120);
  const yearLevel = cleanStr(body.yearLevel, 20);
  const school = cleanStr(body.school, 200);

  const subjects = cleanStrArray(body.subjects, 10, 60);

  const mode: "online" | "in-home" = body.mode === "online" ? "online" : "in-home";

  const suburb = cleanStr(body.suburb, 120);
  const addressLine1 = cleanStr(body.addressLine1, 200);
  const postcode = cleanStr(body.postcode, 10);

  const availabilityBlocks = cleanStrArray(body.availabilityBlocks, 100, 80);

  const goals = cleanStr(body.goals, 2000);
  const challenges = cleanStr(body.challenges, 2000);

  const pkg: PackagePlan = isPackagePlan(body.package) ? body.package : "CASUAL";

  const consent = body.consent === true;
  const source = body.source === "contact" ? "contact" : "direct-enrol";

  if (parentName.length < 2) {
    return NextResponse.json({ ok: false, error: "Parent name is required." }, { status: 400 });
  }
  if (!isEmail(parentEmail)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }
  if (parentPhone.length < 8) {
    return NextResponse.json({ ok: false, error: "A valid phone number is required." }, { status: 400 });
  }
  if (studentName.length < 2) {
    return NextResponse.json({ ok: false, error: "Student name is required." }, { status: 400 });
  }
  if (!yearLevel) {
    return NextResponse.json({ ok: false, error: "Year level is required." }, { status: 400 });
  }
  if (subjects.length < 1) {
    return NextResponse.json({ ok: false, error: "Please select at least one subject." }, { status: 400 });
  }
  if (availabilityBlocks.length < 1) {
    return NextResponse.json({ ok: false, error: "Please select at least one availability time." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ ok: false, error: "Consent is required to submit enrolment." }, { status: 400 });
  }
  if (mode === "in-home" && suburb.length < 2) {
    return NextResponse.json({ ok: false, error: "Suburb is required for in-home tutoring." }, { status: 400 });
  }

  try {
    const ref = await db.collection("leads").add({
      parentName,
      parentEmail,
      parentPhone,

      studentName,
      yearLevel,
      school: school || null,

      subjects,

      mode,
      suburb: suburb || null,
      addressLine1: addressLine1 || null,
      postcode: postcode || null,

      availabilityBlocks,

      goals: goals || null,
      challenges: challenges || null,

      package: pkg,

      consent: true,

      status: "new",

      claimedTutorId: null,
      claimedTutorName: null,
      claimedTutorEmail: null,
      claimedAt: null,

      assignedTutorId: null,
      assignedTutorName: null,
      assignedTutorEmail: null,

      source,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      await sendEnrolmentAlert({
        leadId: ref.id,
        source,
        parentName,
        parentEmail,
        parentPhone,
        studentName,
        yearLevel,
        school,
        subjects,
        mode,
        suburb,
        addressLine1,
        postcode,
        pkg,
        availabilityBlocks,
        goals,
        challenges,
      });
    } catch (mailErr) {
      console.error("[/api/enrol] email failed (non-fatal):", mailErr);
    }

    return NextResponse.json({ ok: true, leadId: ref.id }, { status: 200 });
  } catch (err) {
    console.error("[/api/enrol] failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to submit enrolment. Please try again." }, { status: 500 });
  }
}
