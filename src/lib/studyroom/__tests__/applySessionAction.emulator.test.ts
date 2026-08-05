import { beforeEach, afterAll, describe, it, expect } from "vitest";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { applySessionAction } from "../serverBilling";

// Full end-to-end integration tests against the REAL applySessionAction
// function and a REAL Firestore emulator transaction — not a mock. Requires
// the emulator running on 127.0.0.1:8080 (see package.json "test:emulator").

const TUTOR_UID = "tutor-emu-1";
const fakeUser = { uid: TUTOR_UID } as DecodedIdToken;

function ts(dateStr: string) {
  return Timestamp.fromDate(new Date(dateStr));
}

async function clearCollections() {
  const db = getAdminDb();
  for (const name of ["sessions", "students", "clients", "plans", "entitlements", "invoices"]) {
    const snap = await db.collection(name).get();
    await Promise.all(
      snap.docs.map(async (d) => {
        const logsSnap = await d.ref.collection("logs").get();
        await Promise.all(logsSnap.docs.map((l) => l.ref.delete()));
        await d.ref.delete();
      })
    );
  }
}

async function addNote(sessionId: string, text = "Covered fractions, went well.") {
  const db = getAdminDb();
  await db.collection("sessions").doc(sessionId).collection("logs").add({
    tutorId: TUTOR_UID,
    text,
    attachments: [],
    createdAt: Timestamp.now(),
  });
}

beforeEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await clearCollections();
});

describe("applySessionAction — pricing lock (Release 1A, Stage 3, emulator integration)", () => {
  it("prices a completed session using originalStartAt, unaffected by a subsequent reschedule of startAt", async () => {
    const db = getAdminDb();

    await db.collection("clients").doc("client-1").set({ parentEmail: "parent@example.com" });
    await db.collection("students").doc("student-1").set({ studentName: "Test Student", clientId: "client-1" });

    // Booked before the cutover...
    await db.collection("sessions").doc("s-reschedule-test").set({
      tutorId: TUTOR_UID,
      studentId: "student-1",
      clientId: "client-1",
      planId: null,
      startAt: ts("2026-09-15T10:00:00+10:00"), // ...then "rescheduled" to after the cutover...
      originalStartAt: ts("2026-08-01T10:00:00+10:00"), // ...but originalStartAt (locked at creation) is before it.
      durationMinutes: 60,
      mode: "in_home",
      modality: "IN_HOME",
      status: "scheduled",
    });
    await addNote("s-reschedule-test");

    const result = await applySessionAction({
      sessionId: "s-reschedule-test",
      action: "complete",
      user: fakeUser,
      role: "tutor",
    });

    expect(result.ok).toBe(true);

    const invoiceSnap = await db.collection("invoices").doc(String(result.invoiceId)).get();
    const invoice = invoiceSnap.data();

    // Old in-home rate (7500c) — because originalStartAt is before the
    // cutover, even though the session's current startAt is after it.
    expect(invoice?.amountCents).toBe(7500);
  });

  it("rejects invoicing a session whose mode is not in_home/online, rather than guessing a price", async () => {
    const db = getAdminDb();

    await db.collection("clients").doc("client-2").set({ parentEmail: "parent2@example.com" });
    await db.collection("students").doc("student-2").set({ studentName: "Test Student 2", clientId: "client-2" });

    await db.collection("sessions").doc("s-invalid-mode").set({
      tutorId: TUTOR_UID,
      studentId: "student-2",
      clientId: "client-2",
      planId: null,
      startAt: ts("2026-09-15T10:00:00+10:00"),
      originalStartAt: ts("2026-09-15T10:00:00+10:00"),
      durationMinutes: 60,
      mode: "group",
      modality: "GROUP",
      status: "scheduled",
    });
    await addNote("s-invalid-mode");

    await expect(
      applySessionAction({
        sessionId: "s-invalid-mode",
        action: "complete",
        user: fakeUser,
        role: "tutor",
      })
    ).rejects.toThrow(/unsupported mode/i);
  });
});

describe("applySessionAction — note-required-to-complete gate (Release 1B)", () => {
  async function seedScheduledSession(id: string) {
    const db = getAdminDb();
    await db.collection("clients").doc(`client-${id}`).set({ parentEmail: `${id}@example.com` });
    await db.collection("students").doc(`student-${id}`).set({ studentName: "Test Student", clientId: `client-${id}` });
    await db.collection("sessions").doc(id).set({
      tutorId: TUTOR_UID,
      studentId: `student-${id}`,
      clientId: `client-${id}`,
      planId: null,
      startAt: ts("2026-09-15T10:00:00+10:00"),
      originalStartAt: ts("2026-09-15T10:00:00+10:00"),
      durationMinutes: 60,
      mode: "in_home",
      modality: "IN_HOME",
      status: "scheduled",
    });
  }

  it("rejects completion when zero log entries exist for the session", async () => {
    await seedScheduledSession("s-no-note");

    await expect(
      applySessionAction({ sessionId: "s-no-note", action: "complete", user: fakeUser, role: "tutor" })
    ).rejects.toThrow(/session note is required/i);
  });

  it("rejects completion when a log entry exists but its text is empty/whitespace-only", async () => {
    await seedScheduledSession("s-empty-note");
    await addNote("s-empty-note", "   ");

    await expect(
      applySessionAction({ sessionId: "s-empty-note", action: "complete", user: fakeUser, role: "tutor" })
    ).rejects.toThrow(/session note is required/i);
  });

  it("allows completion once at least one non-empty log entry exists", async () => {
    await seedScheduledSession("s-has-note");
    await addNote("s-has-note", "Covered fractions, went well.");

    const result = await applySessionAction({ sessionId: "s-has-note", action: "complete", user: fakeUser, role: "tutor" });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");
  });

  it("does not require a note for non-complete actions (e.g. cancel_by_tutor)", async () => {
    await seedScheduledSession("s-cancel-no-note");

    const result = await applySessionAction({
      sessionId: "s-cancel-no-note",
      action: "cancel_by_tutor",
      user: fakeUser,
      role: "tutor",
    });
    expect(result.ok).toBe(true);
  });
});

describe("applySessionAction — admin completion (Release 1B.1, atomic 'Complete on behalf of tutor')", () => {
  const ADMIN_UID = "admin-emu-1";
  const fakeAdmin = { uid: ADMIN_UID, email: "lily.studyroom@gmail.com" } as DecodedIdToken;

  async function seedScheduledSessionNoNote(id: string, opts?: { planId?: string | null }) {
    const db = getAdminDb();
    await db.collection("clients").doc(`client-${id}`).set({ parentEmail: `${id}@example.com` });
    await db.collection("students").doc(`student-${id}`).set({ studentName: "Admin Test Student", clientId: `client-${id}` });
    await db.collection("sessions").doc(id).set({
      tutorId: TUTOR_UID,
      studentId: `student-${id}`,
      clientId: `client-${id}`,
      planId: opts?.planId ?? null,
      startAt: ts("2026-09-15T10:00:00+10:00"),
      originalStartAt: ts("2026-09-15T10:00:00+10:00"),
      durationMinutes: 60,
      mode: "in_home",
      modality: "IN_HOME",
      status: "scheduled",
    });
  }

  async function seedPackagePlan(planId: string, remainingSessions: number) {
    const db = getAdminDb();
    await db.collection("plans").doc(planId).set({ type: "package_10", mode: "in_home", status: "active" });
    await db.collection("entitlements").doc(planId).set({ planId, remainingSessions, bonusRemaining: 0, termId: "2026-T3" });
  }

  it("succeeds: casual session completed with note, reason, and audit metadata, invoice created exactly once", async () => {
    const db = getAdminDb();
    await seedScheduledSessionNoNote("s-admin-ok");

    const result = await applySessionAction({
      sessionId: "s-admin-ok",
      action: "complete",
      user: fakeAdmin,
      role: "admin",
      adminCompletion: { note: "Confirmed with tutor by phone.", reason: "Tutor forgot to complete session" },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");

    const session = (await db.collection("sessions").doc("s-admin-ok").get()).data();
    expect(session?.adminCompletedOnBehalfOfTutor).toBe(true);
    expect(session?.adminOverrideBy).toBe("lily.studyroom@gmail.com");
    expect(session?.adminOverrideReason).toBe("Tutor forgot to complete session");
    expect(session?.adminOverrideOutcome).toBe("completed");
    expect(session?.originalTutorId).toBe(TUTOR_UID);

    const logsSnap = await db.collection("sessions").doc("s-admin-ok").collection("logs").get();
    expect(logsSnap.size).toBe(1);
    expect(logsSnap.docs[0].data().text).toBe("Confirmed with tutor by phone.");
    expect(logsSnap.docs[0].data().enteredByAdmin).toBe(true);

    const invoicesSnap = await db.collection("invoices").where("sessionId", "==", "s-admin-ok").get();
    expect(invoicesSnap.size).toBe(1);
  });

  it("records adminReportedActualDate when provided, without altering startAt", async () => {
    const db = getAdminDb();
    await seedScheduledSessionNoNote("s-admin-actualdate");

    await applySessionAction({
      sessionId: "s-admin-actualdate",
      action: "complete",
      user: fakeAdmin,
      role: "admin",
      adminCompletion: {
        note: "Session actually ran a day later than scheduled.",
        reason: "Administrative correction",
        actualCompletionDate: new Date("2026-09-16T10:00:00+10:00"),
      },
    });

    const session = (await db.collection("sessions").doc("s-admin-actualdate").get()).data();
    expect(session?.adminReportedActualDate).toBeDefined();
    expect(session?.startAt.toDate().toISOString()).toBe(ts("2026-09-15T10:00:00+10:00").toDate().toISOString());
  });

  it("deducts a package entitlement exactly once", async () => {
    const db = getAdminDb();
    await seedScheduledSessionNoNote("s-admin-pkg", { planId: "plan-admin-pkg" });
    await seedPackagePlan("plan-admin-pkg", 4);

    await applySessionAction({
      sessionId: "s-admin-pkg",
      action: "complete",
      user: fakeAdmin,
      role: "admin",
      adminCompletion: { note: "Confirmed with tutor.", reason: "Confirmed with tutor manually" },
    });

    const entitlement = (await db.collection("entitlements").doc("plan-admin-pkg").get()).data();
    expect(entitlement?.remainingSessions).toBe(3);
  });

  it("rejects an empty note", async () => {
    await seedScheduledSessionNoNote("s-admin-nonote");
    await expect(
      applySessionAction({
        sessionId: "s-admin-nonote",
        action: "complete",
        user: fakeAdmin,
        role: "admin",
        adminCompletion: { note: "   ", reason: "Administrative correction" },
      })
    ).rejects.toThrow(/session note is required/i);
  });

  it("rejects an empty reason", async () => {
    await seedScheduledSessionNoNote("s-admin-noreason");
    await expect(
      applySessionAction({
        sessionId: "s-admin-noreason",
        action: "complete",
        user: fakeAdmin,
        role: "admin",
        adminCompletion: { note: "Some note.", reason: "" },
      })
    ).rejects.toThrow(/reason is required/i);
  });

  it("is idempotent: a second submission for the same session is refused, not re-processed", async () => {
    const db = getAdminDb();
    await seedScheduledSessionNoNote("s-admin-repeat");

    const first = await applySessionAction({
      sessionId: "s-admin-repeat",
      action: "complete",
      user: fakeAdmin,
      role: "admin",
      adminCompletion: { note: "First submission.", reason: "Tutor forgot to complete session" },
    });
    expect(first.ok).toBe(true);

    await expect(
      applySessionAction({
        sessionId: "s-admin-repeat",
        action: "complete",
        user: fakeAdmin,
        role: "admin",
        adminCompletion: { note: "Second submission.", reason: "Tutor forgot to complete session" },
      })
    ).rejects.toThrow(/already marked/i);

    // Confirm the second (refused) attempt left no trace: still exactly one
    // log entry (the first), and no double-invoice.
    const logsSnap = await db.collection("sessions").doc("s-admin-repeat").collection("logs").get();
    expect(logsSnap.size).toBe(1);
    const invoicesSnap = await db.collection("invoices").where("sessionId", "==", "s-admin-repeat").get();
    expect(invoicesSnap.size).toBe(1);
  });

  it("a simulated mid-transaction failure (no remaining entitlement balance) leaves no partial note, deduction, invoice, or audit state", async () => {
    const db = getAdminDb();
    await seedScheduledSessionNoNote("s-admin-fail", { planId: "plan-admin-fail" });
    // Zero balance — the entitlement-consumption branch throws AFTER the
    // admin note write has already been staged in the same transaction,
    // proving a later failure rolls back everything, not just the part
    // that hadn't executed yet.
    await seedPackagePlan("plan-admin-fail", 0);

    await expect(
      applySessionAction({
        sessionId: "s-admin-fail",
        action: "complete",
        user: fakeAdmin,
        role: "admin",
        adminCompletion: { note: "This should not persist.", reason: "Administrative correction" },
      })
    ).rejects.toThrow(/no remaining entitlement balance/i);

    // Nothing committed: no log entry, session still scheduled, no audit
    // metadata, entitlement unchanged, no invoice.
    const logsSnap = await db.collection("sessions").doc("s-admin-fail").collection("logs").get();
    expect(logsSnap.size).toBe(0);

    const session = (await db.collection("sessions").doc("s-admin-fail").get()).data();
    expect(session?.status).toBe("scheduled");
    expect(session?.adminCompletedOnBehalfOfTutor).toBeUndefined();
    expect(session?.adminOverrideBy).toBeUndefined();

    const entitlement = (await db.collection("entitlements").doc("plan-admin-fail").get()).data();
    expect(entitlement?.remainingSessions).toBe(0);

    const invoicesSnap = await db.collection("invoices").where("sessionId", "==", "s-admin-fail").get();
    expect(invoicesSnap.size).toBe(0);
  });

  it("does not require adminCompletion for a normal tutor completion — unchanged behaviour", async () => {
    await seedScheduledSessionNoNote("s-tutor-unchanged");
    await addNote("s-tutor-unchanged");

    const result = await applySessionAction({ sessionId: "s-tutor-unchanged", action: "complete", user: fakeUser, role: "tutor" });
    expect(result.ok).toBe(true);

    const db = getAdminDb();
    const session = (await db.collection("sessions").doc("s-tutor-unchanged").get()).data();
    expect(session?.adminCompletedOnBehalfOfTutor).toBeUndefined();
  });
});
