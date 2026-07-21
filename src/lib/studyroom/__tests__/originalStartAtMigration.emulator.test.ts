import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { scanSessions, applyInitialization, rollbackDocuments } from "../../../../scripts/lib/originalStartAtMigration.js";

// Verifies the actual migration logic (scripts/lib/originalStartAtMigration.js)
// against a real Firestore emulator before it is ever run against production:
// normal apply, concurrency protection (a document that changes mid-migration
// is skipped, never overwritten), and targeted rollback (only originalStartAt,
// only the listed IDs, everything else untouched).

async function clearSessions() {
  const db = getAdminDb();
  const snap = await db.collection("sessions").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(clearSessions);
afterAll(clearSessions);

describe("originalStartAtMigration — scan + apply (emulator)", () => {
  it("initializes only documents missing the field, skips ones that already have it, leaves other fields untouched", async () => {
    const db = getAdminDb();
    const start = Timestamp.fromDate(new Date("2026-11-01T10:00:00+10:00"));

    await db.collection("sessions").doc("missing-1").set({
      startAt: start,
      endAt: start,
      status: "scheduled",
      durationMinutes: 60,
      notes: "keep me",
    });
    await db.collection("sessions").doc("already-set").set({
      startAt: start,
      originalStartAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00+10:00")), // deliberately different
      status: "completed",
    });

    const scan = await scanSessions(db);
    expect(scan.totalScanned).toBe(2);
    expect(scan.alreadyHasField).toEqual(["already-set"]);
    expect(scan.toInitialize.map((s: { id: string }) => s.id)).toEqual(["missing-1"]);

    const result = await applyInitialization(db, scan.toInitialize);
    expect(result.written).toEqual(["missing-1"]);
    expect(result.skippedAlreadySet).toEqual([]);
    expect(result.skippedChanged).toEqual([]);

    const missing1After = (await db.collection("sessions").doc("missing-1").get()).data()!;
    expect(missing1After.originalStartAt.toMillis()).toBe(start.toMillis());
    // Every other field is untouched.
    expect(missing1After.status).toBe("scheduled");
    expect(missing1After.durationMinutes).toBe(60);
    expect(missing1After.notes).toBe("keep me");

    // The document that already had the field was never touched at all —
    // its (deliberately different, "wrong") value is preserved exactly,
    // proving apply never overwrites an existing originalStartAt.
    const alreadySetAfter = (await db.collection("sessions").doc("already-set").get()).data()!;
    expect(alreadySetAfter.originalStartAt.toMillis()).toBe(
      Timestamp.fromDate(new Date("2026-01-01T00:00:00+10:00")).toMillis()
    );
  });

  it("concurrency protection: skips (never overwrites) a document whose startAt changed after the scan", async () => {
    const db = getAdminDb();
    const originalStart = Timestamp.fromDate(new Date("2026-11-01T10:00:00+10:00"));

    await db.collection("sessions").doc("moved-mid-migration").set({
      startAt: originalStart,
      status: "scheduled",
    });

    const scan = await scanSessions(db);
    expect(scan.toInitialize.map((s: { id: string }) => s.id)).toEqual(["moved-mid-migration"]);

    // Simulate a reschedule happening AFTER the scan but BEFORE the write —
    // exactly the race this protection exists for.
    const rescheduledStart = Timestamp.fromDate(new Date("2026-12-01T10:00:00+10:00"));
    await db.collection("sessions").doc("moved-mid-migration").update({ startAt: rescheduledStart });

    const result = await applyInitialization(db, scan.toInitialize);

    expect(result.written).toEqual([]);
    expect(result.skippedChanged).toHaveLength(1);
    expect(result.skippedChanged[0].id).toBe("moved-mid-migration");
    expect(result.skippedChanged[0].reason).toMatch(/startAt changed/);

    // The document must be completely unaffected: no originalStartAt written,
    // and its rescheduled startAt is exactly what it was set to.
    const after = (await db.collection("sessions").doc("moved-mid-migration").get()).data()!;
    expect(after.originalStartAt).toBeUndefined();
    expect(after.startAt.toMillis()).toBe(rescheduledStart.toMillis());
  });

  it("concurrency protection: skips (never overwrites) a document that got originalStartAt set by something else mid-migration", async () => {
    const db = getAdminDb();
    const start = Timestamp.fromDate(new Date("2026-11-01T10:00:00+10:00"));

    await db.collection("sessions").doc("set-by-someone-else").set({ startAt: start, status: "scheduled" });

    const scan = await scanSessions(db);

    // Simulate another process (e.g. the app's own create path, or a
    // concurrent migration run) setting originalStartAt in between the scan
    // and this script's write.
    const otherValue = Timestamp.fromDate(new Date("2026-11-01T10:00:00+10:00"));
    await db.collection("sessions").doc("set-by-someone-else").update({ originalStartAt: otherValue });

    const result = await applyInitialization(db, scan.toInitialize);

    expect(result.written).toEqual([]);
    expect(result.skippedAlreadySet).toEqual(["set-by-someone-else"]);
  });
});

describe("originalStartAtMigration — rollback (emulator)", () => {
  it("deletes only originalStartAt, only for the listed document IDs, leaving everything else and every other document untouched", async () => {
    const db = getAdminDb();
    const start = Timestamp.fromDate(new Date("2026-11-01T10:00:00+10:00"));

    await db.collection("sessions").doc("rollback-me").set({
      startAt: start,
      originalStartAt: start,
      status: "completed",
      invoiceId: "inv-1",
      notes: "do not touch",
    });
    await db.collection("sessions").doc("not-in-rollback-list").set({
      startAt: start,
      originalStartAt: start,
      status: "scheduled",
    });

    const results = await rollbackDocuments(db, FieldValue, ["rollback-me"]);

    expect(results.deleted).toEqual(["rollback-me"]);
    expect(results.notFound).toEqual([]);
    expect(results.alreadyMissing).toEqual([]);

    const rolledBack = (await db.collection("sessions").doc("rollback-me").get()).data()!;
    expect(rolledBack.originalStartAt).toBeUndefined();
    // Every other field on the rolled-back document is untouched.
    expect(rolledBack.status).toBe("completed");
    expect(rolledBack.invoiceId).toBe("inv-1");
    expect(rolledBack.notes).toBe("do not touch");
    expect(rolledBack.startAt.toMillis()).toBe(start.toMillis());

    // A document NOT in the rollback list is completely unaffected.
    const untouched = (await db.collection("sessions").doc("not-in-rollback-list").get()).data()!;
    expect(untouched.originalStartAt.toMillis()).toBe(start.toMillis());
  });

  it("reports (rather than fails) a document that is already missing the field or no longer exists", async () => {
    const db = getAdminDb();
    const start = Timestamp.fromDate(new Date("2026-11-01T10:00:00+10:00"));
    await db.collection("sessions").doc("no-field").set({ startAt: start });

    const results = await rollbackDocuments(db, FieldValue, ["no-field", "does-not-exist"]);

    expect(results.alreadyMissing).toEqual(["no-field"]);
    expect(results.notFound).toEqual(["does-not-exist"]);
    expect(results.deleted).toEqual([]);
  });
});
