// src/app/api/admin/export/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAdminDb } from "@/lib/firebaseAdmin";

function ts(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object" && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate().toLocaleDateString("en-AU");
  }
  return String(val);
}

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

async function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env var");

  const credentials = JSON.parse(raw) as {
    client_email: string;
    private_key: string;
  };

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function writeSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  values: string[][]
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

export async function POST() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Missing GOOGLE_SHEET_ID env var" }, { status: 500 });
    }

    const db = getAdminDb();
    const sheets = await getSheetsClient();

    // Fetch all collections in parallel
    const [clientsSnap, leadsSnap, studentsSnap] = await Promise.all([
      db.collection("clients").get(),
      db.collection("leads").get(),
      db.collection("students").get(),
    ]);

    // ── Clients ──────────────────────────────────────────────
    const clientHeaders = [
      "Parent Name", "Email", "Phone", "Address", "Suburb", "Postcode",
      "Onboarding Status", "Assigned Tutor", "Created At",
    ];
    const clientRows = clientsSnap.docs.map((d) => {
      const x = d.data();
      return [
        str(x.parentName), str(x.parentEmail), str(x.parentPhone),
        str(x.addressLine1), str(x.suburb), str(x.postcode),
        str(x.onboardingStatus ?? "INCOMPLETE"),
        str(x.assignedTutorName ?? x.assignedTutorEmail ?? x.assignedTutorId),
        ts(x.createdAt),
      ];
    });

    // ── Leads ─────────────────────────────────────────────────
    const leadsHeaders = [
      "Created", "Student Name", "Year Level", "Parent Name", "Email", "Phone",
      "Subjects", "Mode", "Suburb", "Status", "Assigned Tutor", "Source",
    ];
    const leadsRows = leadsSnap.docs.map((d) => {
      const x = d.data();
      const tutor =
        str(x.assignedTutorName ?? x.assignedTutorEmail ?? x.claimedTutorName ?? x.claimedTutorEmail);
      const sourceLabel =
        x.source === "contact" ? "Inquiry" : x.source === "manual" ? `Manual (${str(x.sourceDetail)})` : "Enrolment";
      return [
        ts(x.createdAt), str(x.studentName), str(x.yearLevel),
        str(x.parentName), str(x.parentEmail), str(x.parentPhone),
        str(x.subjects), str(x.mode), str(x.suburb),
        str(x.status), tutor, sourceLabel,
      ];
    });

    // ── Students ──────────────────────────────────────────────
    const studentsHeaders = [
      "Student Name", "Year Level", "School", "Subjects", "Mode", "Suburb",
      "Client ID", "Assigned Tutor", "Goals", "Challenges", "Package",
    ];
    const studentsRows = studentsSnap.docs.map((d) => {
      const x = d.data();
      return [
        str(x.studentName), str(x.yearLevel), str(x.school),
        str(x.subjects), str(x.mode), str(x.suburb),
        str(x.clientId),
        str(x.assignedTutorName ?? x.assignedTutorEmail ?? x.assignedTutorId),
        str(x.goals), str(x.challenges), str(x.package),
      ];
    });

    await Promise.all([
      writeSheet(sheets, spreadsheetId, "Clients", [clientHeaders, ...clientRows]),
      writeSheet(sheets, spreadsheetId, "Leads", [leadsHeaders, ...leadsRows]),
      writeSheet(sheets, spreadsheetId, "Students", [studentsHeaders, ...studentsRows]),
    ]);

    return NextResponse.json({
      ok: true,
      counts: {
        clients: clientRows.length,
        leads: leadsRows.length,
        students: studentsRows.length,
      },
    });
  } catch (err) {
    console.error("[export] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
