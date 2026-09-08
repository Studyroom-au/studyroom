import { readFileSync } from "fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Firestore rules coverage for the two new Release 1C public-intake
// collections (hubEarlyAccess, tutorApplications). Requires the Firestore
// emulator (see package.json "test:emulator"). Tests the REAL firestore.rules
// file from the repo root, matching the convention already used by
// src/lib/scheduling/__tests__/firestore.rules.test.ts.

const ADMIN_EMAIL = "lily.studyroom@gmail.com";
const TUTOR_UID = "tutor-1";
const STUDENT_UID = "student-1";
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
    const db = ctx.firestore();
    await setDoc(doc(db, "roles", TUTOR_UID), { role: "tutor" });
  });
});

for (const collectionName of ["hubEarlyAccess", "tutorApplications"] as const) {
  describe(`firestore.rules — ${collectionName} (Release 1C)`, () => {
    it("admin can read an existing submission", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collectionName, "sub-1"), { name: "Test" });
      });
      const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
      await assertSucceeds(getDoc(doc(adminDb, collectionName, "sub-1")));
    });

    it("an unauthenticated client cannot read a submission", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collectionName, "sub-1"), { name: "Test" });
      });
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, collectionName, "sub-1")));
    });

    it("a non-admin tutor cannot read a submission", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collectionName, "sub-1"), { name: "Test" });
      });
      const tutorDb = testEnv.authenticatedContext(TUTOR_UID, { email: "tutor1@example.com" }).firestore();
      await assertFails(getDoc(doc(tutorDb, collectionName, "sub-1")));
    });

    it("a student cannot read a submission", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collectionName, "sub-1"), { name: "Test" });
      });
      const studentDb = testEnv.authenticatedContext(STUDENT_UID, { email: "student@example.com" }).firestore();
      await assertFails(getDoc(doc(studentDb, collectionName, "sub-1")));
    });

    it("an unauthenticated client cannot create a submission directly", async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(anonDb, collectionName, "spoofed"), { name: "Bot" }));
    });

    it("even an admin cannot write directly via the client SDK (server-only)", async () => {
      const adminDb = testEnv.authenticatedContext("admin-uid", { email: ADMIN_EMAIL }).firestore();
      await assertFails(setDoc(doc(adminDb, collectionName, "admin-direct"), { name: "Should fail" }));
    });
  });
}
