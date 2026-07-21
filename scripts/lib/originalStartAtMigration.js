// scripts/lib/originalStartAtMigration.js
//
// Core, testable logic for the one-time originalStartAt initialization.
// Exported as plain functions (no CLI parsing, no env/credential loading, no
// file I/O for backups) so it can be exercised directly against a Firestore
// instance — production or emulator — from both the CLI script and automated
// tests. See scripts/init-original-start-at.js for the CLI wrapper and the
// full design rationale (idempotency, concurrency protection, rollback).

/**
 * Scans the sessions collection and classifies every document.
 * Read-only — makes no writes.
 */
async function scanSessions(db) {
  const snap = await db.collection("sessions").get();

  const toInitialize = [];
  const alreadyHasField = [];
  const missingValidStartAt = [];

  snap.forEach((doc) => {
    const d = doc.data();
    if (d.originalStartAt !== undefined) {
      alreadyHasField.push(doc.id);
      return;
    }
    if (!d.startAt || typeof d.startAt.toMillis !== "function") {
      missingValidStartAt.push(doc.id);
      return;
    }
    toInitialize.push({ id: doc.id, startAtMs: d.startAt.toMillis() });
  });

  return { totalScanned: snap.size, toInitialize, alreadyHasField, missingValidStartAt };
}

/**
 * Applies the initialization to exactly the documents in `toInitialize`
 * (as produced by scanSessions). Each write is a transaction that re-checks,
 * at write time, that originalStartAt is still missing and startAt still
 * equals the value observed during the scan. A document that has changed
 * either way since the scan is skipped and reported, never overwritten.
 *
 * The update payload is always exactly { originalStartAt: <existingStartAt> }.
 */
async function applyInitialization(db, toInitialize) {
  const written = [];
  const skippedAlreadySet = [];
  const skippedChanged = [];

  for (const { id, startAtMs } of toInitialize) {
    const ref = db.collection("sessions").doc(id);
    try {
      await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(ref);
        if (!freshSnap.exists) {
          skippedChanged.push({ id, reason: "document no longer exists" });
          return;
        }
        const fresh = freshSnap.data();

        if (fresh.originalStartAt !== undefined) {
          skippedAlreadySet.push(id);
          return;
        }
        if (!fresh.startAt || typeof fresh.startAt.toMillis !== "function" || fresh.startAt.toMillis() !== startAtMs) {
          skippedChanged.push({ id, reason: "startAt changed since scan" });
          return;
        }

        tx.update(ref, { originalStartAt: fresh.startAt });
        written.push(id);
      });
    } catch (e) {
      skippedChanged.push({ id, reason: `transaction error: ${e && e.message ? e.message : e}` });
    }
  }

  return { written, skippedAlreadySet, skippedChanged };
}

/**
 * Targeted rollback: deletes ONLY the originalStartAt field, ONLY for the
 * given document IDs. Never touches any other field, never touches any
 * document not in the list.
 */
async function rollbackDocuments(db, FieldValue, documentIds) {
  const deleted = [];
  const notFound = [];
  const alreadyMissing = [];

  for (const id of documentIds) {
    const ref = db.collection("sessions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      notFound.push(id);
      continue;
    }
    if (snap.data().originalStartAt === undefined) {
      alreadyMissing.push(id);
      continue;
    }
    await ref.update({ originalStartAt: FieldValue.delete() });
    deleted.push(id);
  }

  return { deleted, notFound, alreadyMissing };
}

module.exports = { scanSessions, applyInitialization, rollbackDocuments };
