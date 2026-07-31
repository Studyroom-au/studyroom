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
