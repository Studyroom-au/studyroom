// scripts/init-original-start-at.js
//
// One-time initialization: sets originalStartAt = startAt on every session
// document that is missing the field. This establishes each existing
// session's CURRENT startAt as its immutable pricing baseline going forward —
// it does not, and cannot, reconstruct what date a session was originally
// booked for if that information was never recorded. For any session that
// has already been rescheduled at least once before this script runs, its
// pre-reschedule original booking date is not recoverable; this script
// deliberately does not claim otherwise.
//
// Usage:
//   node scripts/init-original-start-at.js --dry-run              (default; read-only)
//   node scripts/init-original-start-at.js --apply                (writes; requires explicit approval)
//   node scripts/init-original-start-at.js --rollback <audit-file> (targeted undo of one specific --apply run)
//
// Guarantees:
//   - Update payload is exactly { originalStartAt: <that document's own
//     existing startAt value> } — no other field is ever read, compared to a
//     new value, or written.
//   - Idempotent: any document that already has originalStartAt is skipped.
//   - Concurrency-safe: each write is a transaction that re-checks, at write
//     time, that originalStartAt is STILL missing and startAt STILL equals
//     the value observed during the initial scan. If either has changed
//     since the scan (someone/something touched the document mid-migration),
//     that document is skipped and reported — never overwritten.
//   - Scoped to ALL sessions missing the field (not just "scheduled" ones).
//   - No invoice, amountCents, billingOutcome, or status field is ever
//     touched, regardless of a session's current status.
//
// The core scan/apply/rollback logic lives in scripts/lib/originalStartAtMigration.js
// (plain, dependency-injectable functions) so it can be exercised against the
// Firestore emulator in automated tests — see
// src/lib/studyroom/__tests__/originalStartAtMigration.emulator.test.ts —
// before ever being run here against production.
//
// Rollback:
//   The full JSON snapshot this script writes on every run is an
//   AUDIT/REFERENCE backup only — Firestore Timestamps serialize through
//   JSON.stringify as plain {_seconds, _nanoseconds} objects, not Timestamp
//   instances, so it is NOT a one-click restorable Firestore backup as-is.
//   The preferred, tested rollback path is --rollback: it reads the exact
//   list of document IDs a specific --apply run actually wrote (from that
//   run's own audit file) and deletes ONLY the originalStartAt field on
//   exactly those documents via FieldValue.delete() — every other field is
//   left untouched. This has been verified against the Firestore emulator
//   (see the test file above) but has NOT been run against production.

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { scanSessions, applyInitialization, rollbackDocuments } = require("./lib/originalStartAtMigration");

const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");
const rollbackFileArg = (() => {
  const idx = process.argv.indexOf("--rollback");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

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
const AUDIT_DIR = path.join(__dirname, "..", "_migration-audit");

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function runRollback(auditFilePath) {
  if (!auditFilePath) {
    console.error("Usage: node scripts/init-original-start-at.js --rollback <path-to-apply-audit-file.json>");
    process.exit(1);
  }
  const auditData = JSON.parse(fs.readFileSync(auditFilePath, "utf8"));
  if (auditData.mode !== "apply" || !Array.isArray(auditData.writtenDocumentIds)) {
    console.error(
      "Refusing to rollback: the given audit file is not an --apply run's audit file " +
        "(expected mode:'apply' and a writtenDocumentIds array)."
    );
    process.exit(1);
  }

  console.log(`Rolling back ${auditData.writtenDocumentIds.length} document(s) from ${auditFilePath}`);
  console.log(`This will ONLY delete the originalStartAt field on these exact IDs. No other field is touched.`);

  const results = await rollbackDocuments(db, admin.firestore.FieldValue, auditData.writtenDocumentIds);

  console.log(`\nDeleted originalStartAt on: ${results.deleted.length}`);
  console.log(`Not found (already gone): ${results.notFound.length}`);
  console.log(`Already missing the field (nothing to do): ${results.alreadyMissing.length}`);

  ensureAuditDir();
  const outPath = path.join(AUDIT_DIR, `rollback-result-${timestamp()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Rollback result written to: ${outPath}`);
}

async function main() {
  if (ROLLBACK) {
    await runRollback(rollbackFileArg);
    process.exit(0);
  }

  const { totalScanned, toInitialize, alreadyHasField, missingValidStartAt } = await scanSessions(db);

  console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY-RUN (read-only, no writes)"}`);
  console.log(`Total sessions scanned: ${totalScanned}`);
  console.log(`Already has originalStartAt (skipped, idempotent): ${alreadyHasField.length}`);
  console.log(`Missing a valid startAt (skipped, cannot initialize): ${missingValidStartAt.length}`);
  if (missingValidStartAt.length > 0) {
    console.log(`  IDs missing valid startAt: ${JSON.stringify(missingValidStartAt)}`);
  }
  console.log(`Will initialize (exact count): ${toInitialize.length}`);
  console.log(`Update payload per document: { originalStartAt: <that document's own existing startAt value> } — nothing else.`);

  ensureAuditDir();
  const stamp = timestamp();

  // AUDIT/REFERENCE snapshot only — see file header. NOT a guaranteed
  // one-click Firestore restore: Timestamps serialize as
  // {_seconds, _nanoseconds} plain objects via JSON.stringify, not as
  // Timestamp instances. The preferred rollback mechanism is --rollback.
  const backupPath = path.join(AUDIT_DIR, `sessions-audit-reference-${stamp}.json`);
  const backup = {};
  (await db.collection("sessions").get()).forEach((doc) => {
    backup[doc.id] = doc.data();
  });
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Audit/reference snapshot (NOT a direct Firestore restore) written to: ${backupPath}`);

  if (!APPLY) {
    const auditPath = path.join(AUDIT_DIR, `originalStartAt-dryrun-${stamp}.json`);
    fs.writeFileSync(
      auditPath,
      JSON.stringify(
        {
          mode: "dry-run",
          totalScanned,
          alreadyHasField: alreadyHasField.length,
          missingValidStartAt,
          willInitializeCount: toInitialize.length,
          documentIds: toInitialize.map((s) => s.id),
        },
        null,
        2
      )
    );
    console.log(`Dry-run audit file (exact document IDs) written to: ${auditPath}`);
    console.log("\nDRY RUN — no writes performed. Re-run with --apply (after separate approval) to write.");
    process.exit(0);
  }

  const { written, skippedAlreadySet, skippedChanged } = await applyInitialization(db, toInitialize);

  console.log(`\nWritten: ${written.length}`);
  console.log(`Skipped — already set by someone else during migration: ${skippedAlreadySet.length}`);
  console.log(`Skipped — changed since scan (never overwritten): ${skippedChanged.length}`);
  if (skippedChanged.length > 0) {
    console.log(`  Details: ${JSON.stringify(skippedChanged, null, 2)}`);
  }

  const afterSnap = await db.collection("sessions").select("originalStartAt").get();
  let hasAfter = 0;
  let missingAfter = 0;
  afterSnap.forEach((d) => {
    if (d.data().originalStartAt !== undefined) hasAfter++;
    else missingAfter++;
  });
  console.log(`\nAfter: ${hasAfter} have originalStartAt, ${missingAfter} still missing.`);

  const applyAuditPath = path.join(AUDIT_DIR, `originalStartAt-apply-${stamp}.json`);
  fs.writeFileSync(
    applyAuditPath,
    JSON.stringify(
      {
        mode: "apply",
        totalScanned,
        writtenCount: written.length,
        writtenDocumentIds: written,
        skippedAlreadySet,
        skippedChanged,
        afterHasField: hasAfter,
        afterMissingField: missingAfter,
      },
      null,
      2
    )
  );
  console.log(`Apply audit file (use this exact file for --rollback if needed) written to: ${applyAuditPath}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
