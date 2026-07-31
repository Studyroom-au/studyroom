// scripts/audit-needs-attention-sessions.js
//
// Read-only production audit. Makes no writes. Reports exactly what the
// current 46 "Needs Attention" records are (old/test/pre-Release-1B data vs
// genuine current exceptions), and what operationsCutoverAt value would
// safely separate them, before any cutover is implemented or written.
//
// Usage: node scripts/audit-needs-attention-sessions.js

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").includes("\\n")
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : process.env.FIREBASE_PRIVATE_KEY;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = admin.firestore();

// ── Replicates src/lib/studyroom/sessionExceptions.ts exactly (read-only
// audit script, plain JS, cannot import the TS module directly) ───────────
const GRACE_MINUTES = 30;
function normalizeStatus(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "completed") return "completed";
  if (s === "cancelled_by_parent" || s === "cancelled_parent") return "cancelled_by_parent";
  if (s === "cancelled_by_tutor" || s === "cancelled_studyroom") return "cancelled_by_tutor";
  if (s === "no_show") return "no_show";
  return "scheduled";
}
function isOverdueScheduled(status, startAt, durationMinutes, now) {
  if (status !== "scheduled") return false;
  const end = new Date(startAt.getTime() + durationMinutes * 60000);
  return now.getTime() > end.getTime() + GRACE_MINUTES * 60000;
}
function hasBillingOutcomeFailure(status, billingOutcome, invoiceStatus) {
  if (status !== "completed") return false;
  if (!billingOutcome) return true;
  if (billingOutcome === "invoice" && invoiceStatus === "xero_failed") return true;
  return false;
}

async function main() {
  const now = new Date();
  const sessionsSnap = await db.collection("sessions").get();
  console.log(`Total sessions documents: ${sessionsSnap.size}`);

  // Preload invoices referenced by sessions (for billing-outcome-failure check)
  const invoiceIds = new Set();
  sessionsSnap.forEach((d) => {
    const iid = d.data().invoiceId;
    if (iid) invoiceIds.add(iid);
  });
  const invoicesById = new Map();
  await Promise.all(
    Array.from(invoiceIds).map(async (id) => {
      const snap = await db.collection("invoices").doc(id).get();
      if (snap.exists) invoicesById.set(id, snap.data());
    })
  );

  // Preload logs subcollection existence per completed session (missing-note check)
  const flagged = [];
  let overdueCount = 0;
  let missingNoteCount = 0;
  let billingFailureCount = 0;

  for (const doc of sessionsSnap.docs) {
    const s = doc.data();
    const status = normalizeStatus(s.status);
    const startAt = s.startAt && s.startAt.toDate ? s.startAt.toDate() : null;
    const durationMinutes = Number(s.durationMinutes ?? s.durationMins ?? 60);
    const invoiceStatus = s.invoiceId ? (invoicesById.get(s.invoiceId) || {}).status ?? null : null;

    const overdue = startAt ? isOverdueScheduled(status, startAt, durationMinutes, now) : false;
    let missingNote = false;
    if (status === "completed") {
      const logsSnap = await db.collection("sessions").doc(doc.id).collection("logs").get();
      missingNote = !logsSnap.docs.some((l) => String(l.data().text ?? "").trim().length > 0);
    }
    const billingFailure = hasBillingOutcomeFailure(status, s.billingOutcome, invoiceStatus);

    if (overdue) overdueCount += 1;
    if (missingNote) missingNoteCount += 1;
    if (billingFailure) billingFailureCount += 1;

    if (overdue || missingNote || billingFailure) {
      let reason = overdue ? "overdue-scheduled" : missingNote ? "missing-note" : "billing-failure";
      flagged.push({
        id: doc.id,
        reason,
        status: s.status,
        startAt,
        originalStartAt: s.originalStartAt && s.originalStartAt.toDate ? s.originalStartAt.toDate() : null,
        studentId: s.studentId,
      });
    }
  }

  console.log(`\nTotal flagged (Needs Attention): ${flagged.length}`);
  console.log(`  overdue-scheduled: ${overdueCount}`);
  console.log(`  missing-note:      ${missingNoteCount}`);
  console.log(`  billing-failure:   ${billingFailureCount}`);

  flagged.sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));

  console.log("\n── Flagged sessions, oldest to newest (by startAt) ──────────");
  flagged.forEach((f) => {
    const dateStr = f.startAt ? f.startAt.toISOString().slice(0, 16).replace("T", " ") : "no startAt";
    console.log(`  ${dateStr}  [${f.reason}]  status=${f.status}  id=${f.id}  studentId=${f.studentId ?? "?"}`);
  });

  // Suggest a cutover: the day after the LAST flagged (old/test) session,
  // at local Brisbane midnight, so every currently-flagged record falls
  // strictly before it.
  const lastFlagged = flagged[flagged.length - 1];
  const allSessionsSorted = sessionsSnap.docs
    .map((d) => (d.data().startAt && d.data().startAt.toDate ? d.data().startAt.toDate() : null))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  const earliestSession = allSessionsSorted[0];
  const latestSession = allSessionsSorted[allSessionsSorted.length - 1];

  console.log("\n── Overall session date range ────────────────────────────");
  console.log(`  Earliest session startAt: ${earliestSession ? earliestSession.toISOString() : "n/a"}`);
  console.log(`  Latest session startAt:   ${latestSession ? latestSession.toISOString() : "n/a"}`);
  console.log(`  Current time (now):        ${now.toISOString()}`);

  if (lastFlagged && lastFlagged.startAt) {
    const nextDay = new Date(lastFlagged.startAt);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const suggestedCutoverDateStr = nextDay.toISOString().slice(0, 10);
    console.log("\n── Suggested cutover ─────────────────────────────────────");
    console.log(`  Last currently-flagged session: ${lastFlagged.startAt.toISOString()}`);
    console.log(`  Suggested operationsCutoverAt:  ${suggestedCutoverDateStr}T00:00:00+10:00 (Brisbane midnight, the day after)`);
    console.log(`  This would exclude all ${flagged.length} currently-flagged sessions from Needs Attention while leaving them fully browseable as history.`);
  } else {
    console.log("\nNo flagged sessions with a valid startAt found — no cutover suggestion computed.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
