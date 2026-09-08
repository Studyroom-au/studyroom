import { readFileSync } from "fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Regression coverage for the Release 1C tutor-request lead privacy hotfix.
// Requires the Firestore emulator (see package.json "test:emulator"). Tests
// the REAL firestore.rules file from the repo root, matching the convention
// in src/lib/scheduling/__tests__/firestore.rules.test.ts.

const ADMIN_EMAIL = "lily.studyroom@gmail.com";
const TUTOR_UID = "tutor-1";
const PROJECT_ID = "demo-studyroom-rules-test";

let testEnv: RulesTestEnvironment;

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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "roles", TUTOR_UID), { role: "tutor" });
  });
});

describe("firestore.rules — leads tutor_request privacy hotfix (Release 1C)", () => {
  it("an ordinary tutor CANNOT read an unclaimed tutor_request applicant record", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "leads", "applicant-1"), {
        type: "tutor_request",
        name: "Other Applicant",
        email: "other.applicant@example.com",
        status: "new",
        claimedTutorId: null,
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertFails(getDoc(doc(tutorDb, "leads", "applicant-1")));
  });

  it("an ordinary tutor CAN still read an eligible, unclaimed ordinary tutoring lead", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "leads", "lead-1"), {
        parentName: "Jane Parent",
        parentEmail: "jane@example.com",
        status: "new",
        claimedTutorId: null,
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertSucceeds(getDoc(doc(tutorDb, "leads", "lead-1")));
  });

  it("an ordinary tutor CAN still read an eligible lead explicitly typed as something other than tutor_request", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "leads", "lead-2"), {
        type: "tutor_invite",
        parentName: "Sam Parent",
        status: "new",
        claimedTutorId: null,
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertSucceeds(getDoc(doc(tutorDb, "leads", "lead-2")));
  });

  it("a tutor's existing ability to read a lead they've claimed is unaffected, even if hypothetically type-tagged", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "leads", "lead-3"), {
        type: "tutor_request",
        status: "assigned",
        claimedTutorId: TUTOR_UID,
      });
    });
    const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
    await assertSucceeds(getDoc(doc(tutorDb, "leads", "lead-3")));
  });

  it("admin access to tutor_request applicant records is unchanged", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "leads", "applicant-2"), {
        type: "tutor_request",
        name: "Another Applicant",
        status: "new",
        claimedTutorId: null,
      });
    });
    const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, "leads", "applicant-2")));
  });

  it("admin access to ordinary leads is unchanged", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "leads", "lead-4"), {
        parentName: "Alex Parent",
        status: "new",
        claimedTutorId: null,
      });
    });
    const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, "leads", "lead-4")));
  });
});
