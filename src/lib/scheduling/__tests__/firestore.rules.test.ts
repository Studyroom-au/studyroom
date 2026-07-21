import { readFileSync } from "fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

// Requires the Firestore emulator running (see package.json "test:emulator").
// Tests the REAL firestore.rules file from the repo root, not a copy.

const TUTOR_UID = "tutor-1";
const OTHER_TUTOR_UID = "tutor-2";
const PROJECT_ID = "demo-studyroom-rules-test";

let testEnv: RulesTestEnvironment;

function baseSessionPayload(startAt: Timestamp) {
  return {
    tutorId: TUTOR_UID,
    tutorEmail: "tutor1@example.com",
    studentId: "student-1",
    clientId: "client-1",
    planId: "plan-1",
    startAt,
    originalStartAt: startAt,
    endAt: Timestamp.fromMillis(startAt.toMillis() + 60 * 60000),
    durationMinutes: 60,
    durationMins: 60,
    modality: "IN_HOME",
    mode: "in_home",
    status: "scheduled",
    legacyStatus: "SCHEDULED",
    notes: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed the roles/{uid} doc so isTutor() resolves true for TUTOR_UID.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "roles", TUTOR_UID), { role: "tutor" });
    await setDoc(doc(db, "roles", OTHER_TUTOR_UID), { role: "tutor" });
  });
});

describe("firestore.rules — sessions create (Release 1A, Stage 3)", () => {
  it("a valid 60-minute in-home session succeeds", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    await assertSucceeds(setDoc(doc(tutorDb, "sessions", "s-valid-in-home"), baseSessionPayload(start)));
  });

  it("a valid 60-minute online session succeeds", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    const payload = { ...baseSessionPayload(start), modality: "ONLINE", mode: "online" };
    await assertSucceeds(setDoc(doc(tutorDb, "sessions", "s-valid-online"), payload));
  });

  it("rejects creation with originalStartAt missing", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    const payload = baseSessionPayload(start) as Record<string, unknown>;
    delete payload.originalStartAt;
    await assertFails(setDoc(doc(tutorDb, "sessions", "s-missing-original"), payload));
  });

  it("rejects creation where originalStartAt != startAt", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    const differentDate = Timestamp.fromDate(new Date("2026-09-08T10:00:00+10:00"));
    const payload = { ...baseSessionPayload(start), originalStartAt: differentDate };
    await assertFails(setDoc(doc(tutorDb, "sessions", "s-mismatched-original"), payload));
  });

  it("rejects a 45-minute session at creation", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    const payload = {
      ...baseSessionPayload(start),
      endAt: Timestamp.fromMillis(start.toMillis() + 45 * 60000),
      durationMinutes: 45,
      durationMins: 45,
    };
    await assertFails(setDoc(doc(tutorDb, "sessions", "s-45min"), payload));
  });

  it("rejects a 90-minute session at creation", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    const payload = {
      ...baseSessionPayload(start),
      endAt: Timestamp.fromMillis(start.toMillis() + 90 * 60000),
      durationMinutes: 90,
      durationMins: 90,
    };
    await assertFails(setDoc(doc(tutorDb, "sessions", "s-90min"), payload));
  });

  it("rejects a 120-minute session at creation (must be two 60-minute sessions instead)", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    const payload = {
      ...baseSessionPayload(start),
      endAt: Timestamp.fromMillis(start.toMillis() + 120 * 60000),
      durationMinutes: 120,
      durationMins: 120,
    };
    await assertFails(setDoc(doc(tutorDb, "sessions", "s-120min"), payload));
  });

  it("rejects group mode at creation", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    const payload = { ...baseSessionPayload(start), modality: "GROUP", mode: "group" };
    await assertFails(setDoc(doc(tutorDb, "sessions", "s-group"), payload));
  });
});

describe("firestore.rules — sessions update (Release 1A, Stage 3)", () => {
  async function seedValidSession(id: string, start: Timestamp) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "sessions", id), baseSessionPayload(start));
    });
  }

  it("the owning tutor cannot modify originalStartAt", async () => {
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    await seedValidSession("s-immutable", start);

    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const newDate = Timestamp.fromDate(new Date("2026-10-01T10:00:00+10:00"));

    await assertFails(
      updateDoc(doc(tutorDb, "sessions", "s-immutable"), {
        originalStartAt: newDate,
        updatedAt: Timestamp.now(),
      })
    );
  });

  it("a plain time-only reschedule (startAt/endAt/updatedAt only) remains allowed", async () => {
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    await seedValidSession("s-reschedulable", start);

    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const newStart = Timestamp.fromDate(new Date("2026-09-01T14:00:00+10:00"));
    const newEnd = Timestamp.fromMillis(newStart.toMillis() + 60 * 60000);

    // Mirrors what the intended client-side "move this session's time" path
    // writes: startAt/endAt/updatedAt only, originalStartAt untouched.
    await assertSucceeds(
      updateDoc(doc(tutorDb, "sessions", "s-reschedulable"), {
        startAt: newStart,
        endAt: newEnd,
        updatedAt: Timestamp.now(),
      })
    );
  });

  it("a different tutor cannot update someone else's session at all", async () => {
    const start = Timestamp.fromDate(new Date("2026-09-01T10:00:00+10:00"));
    await seedValidSession("s-not-mine", start);

    const otherTutorDb = testEnv.authenticatedContext(OTHER_TUTOR_UID, { email: "tutor2@example.com" }).firestore();
    await assertFails(
      updateDoc(doc(otherTutorDb, "sessions", "s-not-mine"), {
        notes: "trying to edit someone else's session",
        updatedAt: Timestamp.now(),
      })
    );
  });
});
