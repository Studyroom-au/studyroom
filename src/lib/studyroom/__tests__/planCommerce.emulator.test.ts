import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { createPlan, renewPlan, correctEntitlementBalance, changeArrangement } from "../planCommerce";

const ACTOR = "lily.studyroom@gmail.com";

async function clearAll() {
  const db = getAdminDb();
  for (const name of ["students", "clients", "plans", "entitlements", "invoices", "settings"]) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

beforeEach(clearAll);
afterAll(clearAll);

// Release 1B.1: pricing is mode-specific (4 prices). Existing tests below
// exercise discount/carry-over/multi-student logic, not mode-price
// differentiation itself (see packagePricing.test.ts for that) — so both
// modes are seeded with the same two base values to keep every pre-existing
// price assertion valid regardless of which mode a given test happens to use.
async function seedPricing(package5 = 42500, package10 = 80000) {
  const db = getAdminDb();
  await db.collection("settings").doc("packagePricing").set({
    package5InHomePriceCents: package5,
    package5OnlinePriceCents: package5,
    package10InHomePriceCents: package10,
    package10OnlinePriceCents: package10,
  });
}

async function seedStudentAndClient(studentId: string, clientId: string) {
  const db = getAdminDb();
  await db.collection("clients").doc(clientId).set({ parentEmail: `${clientId}@example.com` });
  await db.collection("students").doc(studentId).set({ studentName: "Ada", clientId });
}

describe("createPlan (emulator)", () => {
  it("casual: creates a plan only — no entitlement, no invoice", async () => {
    const db = getAdminDb();
    await seedStudentAndClient("s-casual", "c-casual");

    const result = await createPlan(db, {
      clientId: "c-casual",
      studentId: "s-casual",
      mode: "in_home",
      planType: "casual",
      actor: ACTOR,
    });

    expect(result.entitlementId).toBeNull();
    expect(result.invoiceId).toBeNull();

    const plan = (await db.collection("plans").doc(result.planId).get()).data();
    expect(plan?.type).toBe("casual");

    const student = (await db.collection("students").doc("s-casual").get()).data();
    expect(student?.activePlanId).toBe(result.planId);
    // Multi-student-family correction: activePlanId is student-level only —
    // the client doc is never written here, since a family can have several
    // students each with their own plan.
    const client = (await db.collection("clients").doc("c-casual").get()).data();
    expect(client?.activePlanId).toBeUndefined();
  });

  it("package_10 with no discount: entitlement seeded 10+0, invoice at full standard price", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedStudentAndClient("s-10", "c-10");

    const result = await createPlan(db, {
      clientId: "c-10",
      studentId: "s-10",
      mode: "online",
      planType: "package_10",
      actor: ACTOR,
    });

    expect(result.finalPriceCents).toBe(80000);

    const entitlement = (await db.collection("entitlements").doc(result.entitlementId!).get()).data();
    expect(entitlement?.remainingSessions).toBe(10);
    expect(entitlement?.bonusRemaining).toBe(0);

    const invoice = (await db.collection("invoices").doc(result.invoiceId!).get()).data();
    expect(invoice?.invoiceKind).toBe("package_purchase");
    expect(invoice?.amountCents).toBe(80000);
    expect(invoice?.lineItems).toHaveLength(1);

    const plan = (await db.collection("plans").doc(result.planId).get()).data();
    expect(plan?.standardPriceCents).toBe(80000);
    expect(plan?.finalPriceCents).toBe(80000);
    expect(plan?.discountType).toBeNull();
  });

  it("package_5 with a 10% discount: snapshot and invoice reflect the discounted price", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedStudentAndClient("s-5", "c-5");

    const result = await createPlan(db, {
      clientId: "c-5",
      studentId: "s-5",
      mode: "in_home",
      planType: "package_5",
      discountType: "percent",
      discountValue: 10,
      discountReason: "Sibling discount",
      actor: ACTOR,
    });

    expect(result.finalPriceCents).toBe(38250); // 42500 - 10%

    const plan = (await db.collection("plans").doc(result.planId).get()).data();
    expect(plan?.standardPriceCents).toBe(42500);
    expect(plan?.discountType).toBe("percent");
    expect(plan?.discountValue).toBe(10);
    expect(plan?.discountAmountCents).toBe(4250);
    expect(plan?.finalPriceCents).toBe(38250);
    expect(plan?.discountAppliedBy).toBe(ACTOR);

    const invoice = (await db.collection("invoices").doc(result.invoiceId!).get()).data();
    expect(invoice?.amountCents).toBe(38250);
    expect(invoice?.lineItems).toHaveLength(2);
  });

  it("throws if package pricing has not been configured yet", async () => {
    const db = getAdminDb();
    await seedStudentAndClient("s-nopricing", "c-nopricing");
    await expect(
      createPlan(db, { clientId: "c-nopricing", studentId: "s-nopricing", mode: "in_home", planType: "package_10", actor: ACTOR })
    ).rejects.toThrow(/not configured/i);
  });

  it("throws if the student does not exist", async () => {
    const db = getAdminDb();
    await seedPricing();
    await expect(
      createPlan(db, { clientId: "c-x", studentId: "s-does-not-exist", mode: "in_home", planType: "package_10", actor: ACTOR })
    ).rejects.toThrow(/student not found/i);
  });
});

describe("renewPlan (emulator)", () => {
  async function seedExistingPackage(planId: string, opts: { type: string; remainingSessions: number; clientId: string; studentId: string }) {
    const db = getAdminDb();
    await seedStudentAndClient(opts.studentId, opts.clientId);
    await db.collection("plans").doc(planId).set({
      clientId: opts.clientId,
      studentId: opts.studentId,
      type: opts.type,
      mode: "in_home",
      status: "active",
      tutorId: "tutor-1",
      tutorEmail: "tutor1@example.com",
    });
    await db.collection("entitlements").doc(planId).set({
      planId,
      remainingSessions: opts.remainingSessions,
      bonusRemaining: 0,
      termId: "2026-T3",
    });
    await db.collection("students").doc(opts.studentId).set({ activePlanId: planId }, { merge: true });
    await db.collection("clients").doc(opts.clientId).set({ activePlanId: planId }, { merge: true });
  }

  it("renews package_10 -> package_10 with approved carry-over: old plan expires, new entitlement = seed + carryOver", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedExistingPackage("old-plan-1", { type: "package_10", remainingSessions: 2, clientId: "c-r1", studentId: "s-r1" });

    const result = await renewPlan(db, { oldPlanId: "old-plan-1", newPlanType: "package_10", carryOverSessions: 2, actor: ACTOR });

    const oldPlan = (await db.collection("plans").doc("old-plan-1").get()).data();
    expect(oldPlan?.status).toBe("expired");

    const newEntitlement = (await db.collection("entitlements").doc(result.newPlanId).get()).data();
    expect(newEntitlement?.remainingSessions).toBe(12); // 10 seed + 2 carry-over

    const newPlan = (await db.collection("plans").doc(result.newPlanId).get()).data();
    expect(newPlan?.renewedFromPlanId).toBe("old-plan-1");
    expect(newPlan?.carryOverSessions).toBe(2);
    expect(newPlan?.carryOverApprovedBy).toBe(ACTOR);

    const student = (await db.collection("students").doc("s-r1").get()).data();
    expect(student?.activePlanId).toBe(result.newPlanId);
    // Multi-student-family correction: renewal no longer writes the client
    // doc's activePlanId — only the renewing student's own pointer changes.

    const invoice = (await db.collection("invoices").doc(result.invoiceId).get()).data();
    expect(invoice?.invoiceKind).toBe("package_purchase");
    expect(invoice?.planId).toBe(result.newPlanId);
  });

  it("rejects a carry-over greater than the old package's actual remaining balance", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedExistingPackage("old-plan-2", { type: "package_10", remainingSessions: 1, clientId: "c-r2", studentId: "s-r2" });

    await expect(
      renewPlan(db, { oldPlanId: "old-plan-2", newPlanType: "package_10", carryOverSessions: 5, actor: ACTOR })
    ).rejects.toThrow(/cannot exceed/i);
  });

  it("rejects renewing a casual plan (not a package)", async () => {
    const db = getAdminDb();
    await seedPricing();
    const dbAny = getAdminDb();
    await seedStudentAndClient("s-casual-r", "c-casual-r");
    await dbAny.collection("plans").doc("old-casual").set({ clientId: "c-casual-r", studentId: "s-casual-r", type: "casual", status: "active" });

    await expect(
      renewPlan(db, { oldPlanId: "old-casual", newPlanType: "package_10", actor: ACTOR })
    ).rejects.toThrow(/only an existing/i);
  });

  it("rejects renewing a legacy package_12 plan with an explicit legacy message", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedStudentAndClient("s-legacy", "c-legacy");
    await db.collection("plans").doc("old-legacy").set({ clientId: "c-legacy", studentId: "s-legacy", type: "package_12", status: "active" });
    await db.collection("entitlements").doc("old-legacy").set({ remainingSessions: 6, bonusRemaining: 2, termId: "2026-T3" });

    await expect(
      renewPlan(db, { oldPlanId: "old-legacy", newPlanType: "package_10", actor: ACTOR })
    ).rejects.toThrow(/legacy 12-session package/i);
  });

  it("applies a fresh discount decision at renewal, independent of the old plan", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedExistingPackage("old-plan-3", { type: "package_5", remainingSessions: 0, clientId: "c-r3", studentId: "s-r3" });

    const result = await renewPlan(db, {
      oldPlanId: "old-plan-3",
      newPlanType: "package_5",
      carryOverSessions: 0,
      discountType: "fixed",
      discountValue: 2000,
      actor: ACTOR,
    });

    const newPlan = (await db.collection("plans").doc(result.newPlanId).get()).data();
    expect(newPlan?.discountType).toBe("fixed");
    expect(newPlan?.discountAmountCents).toBe(2000);
    expect(newPlan?.finalPriceCents).toBe(40500); // 42500 - 2000
  });
});

describe("correctEntitlementBalance (emulator)", () => {
  async function seedEntitlement(planId: string, remainingSessions: number) {
    const db = getAdminDb();
    await db.collection("entitlements").doc(planId).set({ planId, remainingSessions, bonusRemaining: 0, termId: "2026-T3" });
  }

  it("increases the balance and records a correction event", async () => {
    const db = getAdminDb();
    await seedEntitlement("plan-c1", 3);

    const result = await correctEntitlementBalance(db, { planId: "plan-c1", delta: 2, reason: "Session double-counted", actor: ACTOR });
    expect(result.previousRemainingSessions).toBe(3);
    expect(result.newRemainingSessions).toBe(5);

    const entitlement = (await db.collection("entitlements").doc("plan-c1").get()).data();
    expect(entitlement?.remainingSessions).toBe(5);

    const correction = (await db.collection("entitlements").doc("plan-c1").collection("corrections").doc(result.correctionId).get()).data();
    expect(correction?.delta).toBe(2);
    expect(correction?.reason).toBe("Session double-counted");
    expect(correction?.correctedBy).toBe(ACTOR);
    expect(correction?.previousRemainingSessions).toBe(3);
    expect(correction?.newRemainingSessions).toBe(5);
  });

  it("decreases the balance correctly", async () => {
    const db = getAdminDb();
    await seedEntitlement("plan-c2", 5);
    const result = await correctEntitlementBalance(db, { planId: "plan-c2", delta: -2, reason: "Booked in error", actor: ACTOR });
    expect(result.newRemainingSessions).toBe(3);
  });

  it("rejects a correction that would result in a negative balance", async () => {
    const db = getAdminDb();
    await seedEntitlement("plan-c3", 1);
    await expect(
      correctEntitlementBalance(db, { planId: "plan-c3", delta: -5, reason: "Oops", actor: ACTOR })
    ).rejects.toThrow(/negative balance/i);
  });

  it("rejects an empty reason", async () => {
    const db = getAdminDb();
    await seedEntitlement("plan-c4", 5);
    await expect(
      correctEntitlementBalance(db, { planId: "plan-c4", delta: 1, reason: "   ", actor: ACTOR })
    ).rejects.toThrow(/reason is required/i);
  });

  it("rejects a zero delta", async () => {
    const db = getAdminDb();
    await seedEntitlement("plan-c5", 5);
    await expect(
      correctEntitlementBalance(db, { planId: "plan-c5", delta: 0, reason: "No-op", actor: ACTOR })
    ).rejects.toThrow(/non-zero/i);
  });

  it("rejects a correction for a plan with no entitlement", async () => {
    const db = getAdminDb();
    await expect(
      correctEntitlementBalance(db, { planId: "plan-missing", delta: 1, reason: "test", actor: ACTOR })
    ).rejects.toThrow(/no entitlement found/i);
  });
});

describe("multi-student families (pre-Stage-6 correction)", () => {
  it("creating a second sibling's package does not touch the first sibling's plan or entitlement", async () => {
    const db = getAdminDb();
    await seedPricing();
    await db.collection("clients").doc("family-1").set({ parentEmail: "family1@example.com" });
    await db.collection("students").doc("student-a").set({ studentName: "Student A", clientId: "family-1" });
    await db.collection("students").doc("student-b").set({ studentName: "Student B", clientId: "family-1" });

    const resultA = await createPlan(db, { clientId: "family-1", studentId: "student-a", mode: "in_home", planType: "package_10", actor: ACTOR });
    const resultB = await createPlan(db, { clientId: "family-1", studentId: "student-b", mode: "online", planType: "package_5", actor: ACTOR });

    const studentA = (await db.collection("students").doc("student-a").get()).data();
    const studentB = (await db.collection("students").doc("student-b").get()).data();
    expect(studentA?.activePlanId).toBe(resultA.planId);
    expect(studentB?.activePlanId).toBe(resultB.planId);
    expect(studentA?.activePlanId).not.toBe(studentB?.activePlanId);

    // The client doc's activePlanId is no longer written by createPlan at all —
    // confirms it can never point at "whichever sibling was created last".
    const client = (await db.collection("clients").doc("family-1").get()).data();
    expect(client?.activePlanId).toBeUndefined();

    const entitlementA = (await db.collection("entitlements").doc(resultA.entitlementId!).get()).data();
    const entitlementB = (await db.collection("entitlements").doc(resultB.entitlementId!).get()).data();
    expect(entitlementA?.remainingSessions).toBe(10);
    expect(entitlementB?.remainingSessions).toBe(5);
  });

  it("renewing one sibling's package does not alter another sibling's current package", async () => {
    const db = getAdminDb();
    await seedPricing();
    await db.collection("clients").doc("family-2").set({ parentEmail: "family2@example.com" });
    await db.collection("students").doc("student-c").set({ studentName: "Student C", clientId: "family-2" });
    await db.collection("students").doc("student-d").set({ studentName: "Student D", clientId: "family-2" });

    const resultC = await createPlan(db, { clientId: "family-2", studentId: "student-c", mode: "in_home", planType: "package_10", actor: ACTOR });
    const resultD = await createPlan(db, { clientId: "family-2", studentId: "student-d", mode: "in_home", planType: "package_5", actor: ACTOR });

    // Student C renews their package.
    const renewC = await renewPlan(db, { oldPlanId: resultC.planId, newPlanType: "package_10", carryOverSessions: 0, actor: ACTOR });

    const studentC = (await db.collection("students").doc("student-c").get()).data();
    const studentD = (await db.collection("students").doc("student-d").get()).data();
    expect(studentC?.activePlanId).toBe(renewC.newPlanId);
    // Student D's plan/entitlement must be completely untouched by C's renewal.
    expect(studentD?.activePlanId).toBe(resultD.planId);

    const entitlementD = (await db.collection("entitlements").doc(resultD.entitlementId!).get()).data();
    expect(entitlementD?.remainingSessions).toBe(5);

    const planD = (await db.collection("plans").doc(resultD.planId).get()).data();
    expect(planD?.status).toBe("active"); // never flipped to expired by C's renewal
  });
});

describe("changeArrangement (emulator) — Release 1B.1", () => {
  async function seedCasual(studentId: string, clientId: string, planId: string) {
    const db = getAdminDb();
    await seedStudentAndClient(studentId, clientId);
    await db.collection("plans").doc(planId).set({
      clientId,
      studentId,
      type: "casual",
      mode: "in_home",
      status: "active",
    });
    await db.collection("students").doc(studentId).set({ activePlanId: planId }, { merge: true });
  }

  async function seedLegacy(studentId: string, clientId: string, planId: string, remainingSessions: number) {
    const db = getAdminDb();
    await seedStudentAndClient(studentId, clientId);
    await db.collection("plans").doc(planId).set({
      clientId,
      studentId,
      type: "package_12",
      mode: "in_home",
      status: "active",
    });
    await db.collection("entitlements").doc(planId).set({ planId, remainingSessions, bonusRemaining: 2, termId: "2026-T3" });
    await db.collection("students").doc(studentId).set({ activePlanId: planId }, { merge: true });
  }

  it("no plan at all -> package_10: creates plan/entitlement/invoice, no prior plan to expire", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedStudentAndClient("s-none", "c-none");

    const result = await changeArrangement(db, {
      studentId: "s-none",
      targetPlanType: "package_10",
      mode: "in_home",
      reason: "Family agreed to a 10-session package",
      actor: ACTOR,
    });

    expect(result.oldPlanId).toBeNull();
    const entitlement = (await db.collection("entitlements").doc(result.entitlementId!).get()).data();
    expect(entitlement?.remainingSessions).toBe(10);
    const student = (await db.collection("students").doc("s-none").get()).data();
    expect(student?.activePlanId).toBe(result.newPlanId);
  });

  it("Casual -> package_5: expires the Casual plan, creates package_5 plan+entitlement+invoice", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedCasual("s-c5", "c-c5", "old-casual-1");

    const result = await changeArrangement(db, {
      studentId: "s-c5",
      targetPlanType: "package_5",
      mode: "in_home",
      reason: "Moving from casual to a 5-session package",
      actor: ACTOR,
    });

    const oldPlan = (await db.collection("plans").doc("old-casual-1").get()).data();
    expect(oldPlan?.status).toBe("expired");
    expect(oldPlan?.type).toBe("casual"); // history preserved, never rewritten

    const newPlan = (await db.collection("plans").doc(result.newPlanId).get()).data();
    expect(newPlan?.type).toBe("package_5");
    expect(newPlan?.changedFromPlanId).toBe("old-casual-1");
    expect(newPlan?.standardPriceCents).toBe(42500);

    const entitlement = (await db.collection("entitlements").doc(result.entitlementId!).get()).data();
    expect(entitlement?.remainingSessions).toBe(5);

    const invoicesSnap = await db.collection("invoices").where("studentId", "==", "s-c5").get();
    expect(invoicesSnap.size).toBe(1); // no duplicate invoice

    const student = (await db.collection("students").doc("s-c5").get()).data();
    expect(student?.activePlanId).toBe(result.newPlanId);
  });

  it("Casual -> package_10 with sessions already delivered: starting balance reduced, never negative, fully auditable", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedCasual("s-c10", "c-c10", "old-casual-2");

    const result = await changeArrangement(db, {
      studentId: "s-c10",
      targetPlanType: "package_10",
      mode: "online",
      sessionsAlreadyCompleted: 3,
      reason: "Two casual sessions already delivered before the package was entered by admin",
      actor: ACTOR,
    });

    const entitlement = (await db.collection("entitlements").doc(result.entitlementId!).get()).data();
    expect(entitlement?.remainingSessions).toBe(7); // 10 seed - 3 already completed

    const newPlan = (await db.collection("plans").doc(result.newPlanId).get()).data();
    expect(newPlan?.initialSessionsAlreadyCompleted).toBe(3);
    expect(newPlan?.arrangementChangedBy).toBe(ACTOR);
    expect(newPlan?.arrangementChangeReason).toMatch(/already delivered/i);

    // Invoice is for the full package price — already-delivered sessions
    // were billed separately as casual invoices, never duplicated here.
    const invoice = (await db.collection("invoices").doc(result.invoiceId!).get()).data();
    expect(invoice?.amountCents).toBe(80000);
  });

  it("rejects sessionsAlreadyCompleted greater than the new package's own seed size", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedCasual("s-toomany", "c-toomany", "old-casual-3");

    await expect(
      changeArrangement(db, {
        studentId: "s-toomany",
        targetPlanType: "package_5",
        mode: "in_home",
        sessionsAlreadyCompleted: 6,
        reason: "test",
        actor: ACTOR,
      })
    ).rejects.toThrow(/only includes 5/i);
  });

  it("legacy package_12 -> package_5 with carry-over capped at actual remaining legacy balance", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedLegacy("s-legacy5", "c-legacy5", "old-legacy-1", 4);

    const result = await changeArrangement(db, {
      studentId: "s-legacy5",
      targetPlanType: "package_5",
      mode: "in_home",
      carryOverSessions: 4,
      reason: "Transitioning off the legacy 12-session package",
      actor: ACTOR,
    });

    const oldPlan = (await db.collection("plans").doc("old-legacy-1").get()).data();
    expect(oldPlan?.status).toBe("expired");
    expect(oldPlan?.type).toBe("package_12"); // legacy history preserved as-is

    const entitlement = (await db.collection("entitlements").doc(result.entitlementId!).get()).data();
    expect(entitlement?.remainingSessions).toBe(9); // 5 seed + 4 carry-over
  });

  it("legacy package_12 -> package_10 rejects carry-over greater than the legacy balance", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedLegacy("s-legacy10", "c-legacy10", "old-legacy-2", 2);

    await expect(
      changeArrangement(db, {
        studentId: "s-legacy10",
        targetPlanType: "package_10",
        mode: "in_home",
        carryOverSessions: 5,
        reason: "test",
        actor: ACTOR,
      })
    ).rejects.toThrow(/cannot exceed/i);
  });

  it("rejects setting both sessionsAlreadyCompleted and carryOverSessions at once", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedCasual("s-both", "c-both", "old-casual-4");

    await expect(
      changeArrangement(db, {
        studentId: "s-both",
        targetPlanType: "package_5",
        mode: "in_home",
        sessionsAlreadyCompleted: 1,
        carryOverSessions: 1,
        reason: "test",
        actor: ACTOR,
      })
    ).rejects.toThrow(/only one of/i);
  });

  it("rejects a missing reason", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedCasual("s-noreason", "c-noreason", "old-casual-5");

    await expect(
      changeArrangement(db, { studentId: "s-noreason", targetPlanType: "package_5", mode: "in_home", reason: "", actor: ACTOR })
    ).rejects.toThrow(/reason is required/i);
  });

  it("rejects changing an already-current package_5/package_10 plan (must use renewPlan instead)", async () => {
    const db = getAdminDb();
    await seedPricing();
    await seedStudentAndClient("s-alreadypkg", "c-alreadypkg");
    await db.collection("plans").doc("existing-pkg").set({ clientId: "c-alreadypkg", studentId: "s-alreadypkg", type: "package_5", status: "active", mode: "in_home" });
    await db.collection("entitlements").doc("existing-pkg").set({ remainingSessions: 3, bonusRemaining: 0, termId: "2026-T3" });
    await db.collection("students").doc("s-alreadypkg").set({ activePlanId: "existing-pkg" }, { merge: true });

    await expect(
      changeArrangement(db, { studentId: "s-alreadypkg", targetPlanType: "package_10", mode: "in_home", reason: "test", actor: ACTOR })
    ).rejects.toThrow(/renew package/i);
  });

  it("sibling's arrangement is completely unaffected by another sibling's change", async () => {
    const db = getAdminDb();
    await seedPricing();
    await db.collection("clients").doc("family-3").set({ parentEmail: "family3@example.com" });
    await db.collection("students").doc("student-e").set({ studentName: "Student E", clientId: "family-3" });
    await db.collection("students").doc("student-f").set({ studentName: "Student F", clientId: "family-3" });
    await db.collection("plans").doc("casual-e").set({ clientId: "family-3", studentId: "student-e", type: "casual", status: "active", mode: "in_home" });
    await db.collection("plans").doc("casual-f").set({ clientId: "family-3", studentId: "student-f", type: "casual", status: "active", mode: "in_home" });
    await db.collection("students").doc("student-e").set({ activePlanId: "casual-e" }, { merge: true });
    await db.collection("students").doc("student-f").set({ activePlanId: "casual-f" }, { merge: true });

    await changeArrangement(db, { studentId: "student-e", targetPlanType: "package_10", mode: "in_home", reason: "test", actor: ACTOR });

    const studentF = (await db.collection("students").doc("student-f").get()).data();
    expect(studentF?.activePlanId).toBe("casual-f"); // untouched

    const planF = (await db.collection("plans").doc("casual-f").get()).data();
    expect(planF?.status).toBe("active"); // never flipped to expired by sibling's change
  });
});
