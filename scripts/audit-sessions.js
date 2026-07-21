// scripts/audit-sessions.js
//
// Read-only production audit. Makes no writes. Reports exactly the fields
// needed at each deployment checkpoint for the originalStartAt rollout:
//   - total sessions
//   - status breakdown (completed / scheduled / cancelled / other)
//   - sessions with / without originalStartAt
//   - non-60-minute sessions (durationMinutes and durationMins, separately)
//   - invalid modes (anything other than in_home/online, by mode and by modality)
//
// Usage: node scripts/audit-sessions.js

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

async function main() {
  const snap = await db
    .collection("sessions")
    .select("status", "durationMinutes", "durationMins", "mode", "modality", "originalStartAt", "startAt")
    .get();

  let completed = 0;
  let cancelled = 0;
  let scheduled = 0;
  let otherStatus = 0;

  let hasOriginalStartAt = 0;
  let missingOriginalStartAt = 0;
  let missingValidStartAt = 0;

  const nonStandardDurationMinutes = [];
  const nonStandardDurationMins = [];
  const invalidModes = [];
  const invalidModalities = [];

  snap.forEach((doc) => {
    const d = doc.data();
    const status = String(d.status ?? "").toLowerCase();

    if (status === "completed") completed++;
    else if (status.includes("cancel")) cancelled++;
    else if (status === "scheduled") scheduled++;
    else otherStatus++;

    if (d.originalStartAt !== undefined) hasOriginalStartAt++;
    else missingOriginalStartAt++;

    if (!d.startAt || typeof d.startAt.toDate !== "function") missingValidStartAt++;

    if (d.durationMinutes !== undefined && d.durationMinutes !== 60) nonStandardDurationMinutes.push(doc.id);
    if (d.durationMins !== undefined && d.durationMins !== 60) nonStandardDurationMins.push(doc.id);

    if (d.mode !== undefined && d.mode !== "in_home" && d.mode !== "online") invalidModes.push({ id: doc.id, mode: d.mode });
    if (d.modality !== undefined && d.modality !== "IN_HOME" && d.modality !== "ONLINE") {
      invalidModalities.push({ id: doc.id, modality: d.modality });
    }
  });

  console.log(`Total sessions: ${snap.size}`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Scheduled: ${scheduled}`);
  console.log(`  Cancelled: ${cancelled}`);
  console.log(`  Other/unrecognized status: ${otherStatus}`);
  console.log("");
  console.log(`Has originalStartAt: ${hasOriginalStartAt}`);
  console.log(`Missing originalStartAt: ${missingOriginalStartAt}`);
  console.log(`Missing a valid startAt: ${missingValidStartAt}`);
  console.log("");
  console.log(`Non-60-minute (durationMinutes): ${nonStandardDurationMinutes.length}${nonStandardDurationMinutes.length ? " -> " + JSON.stringify(nonStandardDurationMinutes) : ""}`);
  console.log(`Non-60-minute (durationMins): ${nonStandardDurationMins.length}${nonStandardDurationMins.length ? " -> " + JSON.stringify(nonStandardDurationMins) : ""}`);
  console.log(`Invalid mode (not in_home/online): ${invalidModes.length}${invalidModes.length ? " -> " + JSON.stringify(invalidModes) : ""}`);
  console.log(`Invalid modality (not IN_HOME/ONLINE): ${invalidModalities.length}${invalidModalities.length ? " -> " + JSON.stringify(invalidModalities) : ""}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
