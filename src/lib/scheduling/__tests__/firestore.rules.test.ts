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
  deleteDoc,
  getDoc,
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

describe("firestore.rules — Release 1B, Stage 4: commercial writes have no client-side bypass", () => {
  const ADMIN_UID = "admin-1";
  const ADMIN_EMAIL = "lily.studyroom@gmail.com";

  it("admin can read settings/packagePricing", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "settings", "packagePricing"), {
        package5PriceCents: 42500,
        package10PriceCents: 80000,
      });
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    const { getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(adminDb, "settings", "packagePricing")));
  });

  it("admin cannot write settings/packagePricing directly from the client SDK", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertFails(
      setDoc(doc(adminDb, "settings", "packagePricing"), { package5PriceCents: 1, package10PriceCents: 1 })
    );
  });

  it("admin cannot write plans directly from the client SDK (must go through /api/plans/*)", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertFails(setDoc(doc(adminDb, "plans", "p-1"), { type: "package_10", status: "active" }));
  });

  it("admin can still read plans directly from the client SDK", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "plans", "p-read"), { type: "package_10", status: "active" });
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    const { getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(adminDb, "plans", "p-read")));
  });

  it("admin cannot write entitlements directly from the client SDK", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertFails(setDoc(doc(adminDb, "entitlements", "e-1"), { remainingSessions: 10, bonusRemaining: 0 }));
  });

  it("admin cannot write invoices directly from the client SDK", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertFails(setDoc(doc(adminDb, "invoices", "i-1"), { status: "paid" }));
  });

  it("admin can still write ordinary client fields directly (parent info, admin notes)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "client-ord"), { parentName: "Original" });
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(updateDoc(doc(adminDb, "clients", "client-ord"), { parentName: "Updated", updatedAt: Timestamp.now() }));
  });

  it("admin cannot write discountPreference fields on clients directly from the client SDK (must go through /api/clients/[clientId]/discount-preference)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "client-discount"), { parentName: "Test" });
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertFails(
      updateDoc(doc(adminDb, "clients", "client-discount"), {
        discountPreferenceType: "percent",
        discountPreferenceValue: 10,
      })
    );
  });
});

describe("firestore.rules — multi-student-family client access (pre-Stage-6 correction)", () => {
  it("a tutor listed only in assignedTutorIds (not the singular assignedTutorId) can still read the shared client record", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "family-multi"), {
        parentName: "Multi-Kid Family",
        assignedTutorId: OTHER_TUTOR_UID, // sibling's tutor — the legacy singular field
        assignedTutorIds: [TUTOR_UID, OTHER_TUTOR_UID], // both siblings' tutors
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const { getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(tutorDb, "clients", "family-multi")));
  });

  it("a tutor not in assignedTutorIds and not matching the singular field cannot read the client record", async () => {
    const THIRD_TUTOR_UID = "tutor-3";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "roles", THIRD_TUTOR_UID), { role: "tutor" });
      await setDoc(doc(ctx.firestore(), "clients", "family-exclusive"), {
        parentName: "Other Family",
        assignedTutorId: TUTOR_UID,
        assignedTutorIds: [TUTOR_UID, OTHER_TUTOR_UID],
      });
    });
    const thirdTutorDb = testEnv.authenticatedContext(THIRD_TUTOR_UID, { email: "tutor3@example.com" }).firestore();
    const { getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(thirdTutorDb, "clients", "family-exclusive")));
  });

  it("both tutors assigned to different siblings under the same family can read the shared client record", async () => {
    // assignedTutorId (singular, legacy display field) only ever matches
    // TUTOR_UID here — OTHER_TUTOR_UID can only read via assignedTutorIds,
    // which is exactly the mechanism this test is proving.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "family-two-tutors"), {
        parentName: "Two Sibling Family",
        assignedTutorId: TUTOR_UID,
        assignedTutorIds: [TUTOR_UID, OTHER_TUTOR_UID],
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    const otherTutorDb = testEnv.authenticatedContext(OTHER_TUTOR_UID, { email: "tutor2@example.com" }).firestore();
    await assertSucceeds(getDoc(doc(tutorDb, "clients", "family-two-tutors")));
    await assertSucceeds(getDoc(doc(otherTutorDb, "clients", "family-two-tutors")));
  });
});

describe("firestore.rules — clients create/update/delete (pre-publish audit fix)", () => {
  const ADMIN_UID = "admin-2";
  const ADMIN_EMAIL = "lily.studyroom@gmail.com";

  it("admin can create a brand-new client document from the browser (Add Existing Student / lead conversion)", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, "clients", "client-new"), {
        parentName: "Brand New Family",
        parentEmail: "new-family@example.com",
        parentPhone: null,
        assignedTutorId: TUTOR_UID,
        assignedTutorIds: [TUTOR_UID],
        status: "active",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    );
  });

  it("admin cannot create a new client document that already carries a discountPreference field", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertFails(
      setDoc(doc(adminDb, "clients", "client-new-with-discount"), {
        parentName: "Sneaky Discount",
        discountPreferenceType: "percent",
        discountPreferenceValue: 20,
      })
    );
  });

  it("a non-admin (tutor) cannot create a client document at all", async () => {
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertFails(
      setDoc(doc(tutorDb, "clients", "client-by-tutor"), { parentName: "Should not work" })
    );
  });

  it("admin can update an ordinary field on an existing client", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "client-update-ord"), { parentName: "Before", status: "active" });
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(
      updateDoc(doc(adminDb, "clients", "client-update-ord"), { status: "ended", endedAt: Timestamp.now(), updatedAt: Timestamp.now() })
    );
  });

  it("a tutor cannot modify commercial/admin fields on a client they're assigned to (only tutorNotes is allowed)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "client-tutor-scope"), {
        parentName: "Original Name",
        assignedTutorId: TUTOR_UID,
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertFails(
      updateDoc(doc(tutorDb, "clients", "client-tutor-scope"), { parentName: "Tutor tried to rename the parent" })
    );
    await assertSucceeds(
      updateDoc(doc(tutorDb, "clients", "client-tutor-scope"), { tutorNotes: "Great session today", updatedAt: Timestamp.now() })
    );
  });

  it("admin can permanently delete a client (guarded by the app UI, not by this rule)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "client-to-delete"), { parentName: "Mistake Entry" });
    });
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(deleteDoc(doc(adminDb, "clients", "client-to-delete")));
  });

  it("a non-admin cannot delete a client document", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "client-no-delete"), {
        parentName: "Protected Family",
        assignedTutorId: TUTOR_UID,
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertFails(deleteDoc(doc(tutorDb, "clients", "client-no-delete")));
  });
});

describe("firestore.rules — actionDismissals (Operations Centre dismiss, admin-only)", () => {
  const ADMIN_UID = "admin-3";
  const ADMIN_EMAIL = "lily.studyroom@gmail.com";

  it("admin can create and read an action dismissal", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, "actionDismissals", "missing-note:session-1"), {
        key: "missing-note:session-1",
        label: "Test Student — session missing a note",
        dismissedBy: ADMIN_EMAIL,
        dismissedAt: Timestamp.now(),
      })
    );
    await assertSucceeds(getDoc(doc(adminDb, "actionDismissals", "missing-note:session-1")));
  });

  it("a tutor cannot read or write actionDismissals", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "actionDismissals", "invoice:inv-1"), {
        key: "invoice:inv-1",
        label: "Test",
        dismissedBy: "someone",
        dismissedAt: Timestamp.now(),
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertFails(getDoc(doc(tutorDb, "actionDismissals", "invoice:inv-1")));
    await assertFails(
      setDoc(doc(tutorDb, "actionDismissals", "invoice:inv-2"), {
        key: "invoice:inv-2",
        label: "Test",
        dismissedBy: "tutor",
        dismissedAt: Timestamp.now(),
      })
    );
  });
});
