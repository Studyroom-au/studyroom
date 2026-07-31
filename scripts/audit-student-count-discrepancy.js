// scripts/audit-student-count-discrepancy.js
//
// Read-only production audit. Makes no writes. Explains the exact gap
// between /hub/admin/clients "Current Students" and /hub/admin Operational
// Health "Active students" before either implementation is changed.
//
// Usage: node scripts/audit-student-count-discrepancy.js

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
  const [studentsSnap, clientsSnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("clients").get(),
  ]);

  const clientsById = new Map();
  clientsSnap.forEach((d) => clientsById.set(d.id, d.data()));
  const nonArchivedClientIds = new Set(
    clientsSnap.docs.filter((d) => d.data().status !== "ended").map((d) => d.id)
  );
  const archivedClientIds = new Set(
    clientsSnap.docs.filter((d) => d.data().status === "ended").map((d) => d.id)
  );

  console.log(`Total students documents: ${studentsSnap.size}`);
  console.log(`Total clients documents: ${clientsSnap.size} (${archivedClientIds.size} archived/ended, ${nonArchivedClientIds.size} non-archived)`);
  console.log("");

  let endedStudents = 0;
  let pausedStudents = 0;
  let activeOrDefaultStudents = 0;
  let noClientId = 0;
  let clientIdMissingDoc = 0;
  let clientIdArchived = 0;
  let clientIdNonArchived = 0;
  let missingStatusField = 0;

  // Replicates the CURRENT (buggy) admin/page.tsx formula exactly.
  let oldOpsCentreFormulaCount = 0;
  // Replicates the CURRENT admin/clients/page.tsx formula exactly (a
  // student counts only if their clientId resolves to an existing,
  // non-archived client AND their own status isn't "ended").
  let clientsPageFormulaCount = 0;

  const orphanExamples = [];
  const archivedFamilyExamples = [];

  studentsSnap.forEach((d) => {
    const s = d.data();
    const status = s.status;
    const clientId = String(s.clientId ?? "");

    if (status === undefined) missingStatusField += 1;
    if (status === "ended") endedStudents += 1;
    else if (status === "paused") pausedStudents += 1;
    else activeOrDefaultStudents += 1;

    if (!clientId) {
      noClientId += 1;
      if (orphanExamples.length < 10) orphanExamples.push({ id: d.id, name: s.studentName, reason: "no clientId" });
    } else if (!clientsById.has(clientId)) {
      clientIdMissingDoc += 1;
      if (orphanExamples.length < 10) orphanExamples.push({ id: d.id, name: s.studentName, reason: `clientId ${clientId} has no client doc` });
    } else if (archivedClientIds.has(clientId)) {
      clientIdArchived += 1;
      if (archivedFamilyExamples.length < 10) {
        archivedFamilyExamples.push({ id: d.id, name: s.studentName, status, clientId, parentName: clientsById.get(clientId).parentName });
      }
    } else if (nonArchivedClientIds.has(clientId)) {
      clientIdNonArchived += 1;
    }

    // OLD admin/page.tsx formula: exclude ended/paused by own status; exclude
    // only if clientId is IN the archived set (empty/missing clientId, or a
    // clientId with no matching doc, is NOT excluded -> silently counts).
    const oldExcludedByOwnStatus = status === "ended" || status === "paused";
    const oldExcludedByArchivedClient = !!clientId && archivedClientIds.has(clientId);
    if (!oldExcludedByOwnStatus && !oldExcludedByArchivedClient) oldOpsCentreFormulaCount += 1;

    // Clients-page formula: must belong to an existing, non-archived client,
    // AND own status must not be "ended" (paused DOES count).
    const belongsToCurrentFamily = !!clientId && nonArchivedClientIds.has(clientId);
    if (belongsToCurrentFamily && status !== "ended") clientsPageFormulaCount += 1;
  });

  console.log("── Student status breakdown ──────────────────────────────");
  console.log(`  status "ended":            ${endedStudents}`);
  console.log(`  status "paused":           ${pausedStudents}`);
  console.log(`  status "active"/other/none: ${activeOrDefaultStudents}`);
  console.log(`  (missing status field entirely: ${missingStatusField})`);
  console.log("");
  console.log("── clientId resolution breakdown ─────────────────────────");
  console.log(`  no clientId at all:                 ${noClientId}`);
  console.log(`  clientId set but no matching client doc: ${clientIdMissingDoc}`);
  console.log(`  clientId resolves to an ARCHIVED client: ${clientIdArchived}`);
  console.log(`  clientId resolves to a non-archived client: ${clientIdNonArchived}`);
  console.log("");
  console.log("── Formula comparison ────────────────────────────────────");
  console.log(`  OLD /hub/admin formula (buggy):        ${oldOpsCentreFormulaCount}`);
  console.log(`  /hub/admin/clients formula (correct):  ${clientsPageFormulaCount}`);
  console.log(`  Difference:                             ${oldOpsCentreFormulaCount - clientsPageFormulaCount}`);
  console.log("");
  if (orphanExamples.length > 0) {
    console.log("── Orphaned student examples (no valid client) ───────────");
    orphanExamples.forEach((o) => console.log(`  id=${o.id} name=${o.name ?? "?"} — ${o.reason}`));
    console.log("");
  }
  if (archivedFamilyExamples.length > 0) {
    console.log("── Students under an archived family, own status still non-ended ──");
    archivedFamilyExamples.forEach((a) =>
      console.log(`  id=${a.id} name=${a.name ?? "?"} status=${a.status} family=${a.parentName ?? "?"} (${a.clientId})`)
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
