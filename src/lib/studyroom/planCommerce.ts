import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  CASUAL_INVOICE_DUE_DAYS,
  addDays,
  buildPackageInvoiceLineItems,
  computeDiscount,
  getDefaultSessionRateCents,
  getEntitlementSeed,
  inferTermId,
  normalizeMode,
  type DiscountType,
  type StudyroomMode,
} from "@/lib/studyroom/billing";

// Release 1B, Stage 5: the actual transactional logic behind
// POST /api/plans/create and POST /api/plans/renew, factored out of the HTTP
// route layer (same separation serverBilling.ts already uses for
// applySessionAction) so it can be exercised directly against the Firestore
// emulator without needing a Firebase Auth emulator too — the route itself
// does auth, then delegates here with an already-verified `actor` string.

export type CreatablePlanType = "casual" | "package_5" | "package_10";
export type RenewablePlanType = "package_5" | "package_10";

export type CreatePlanArgs = {
  clientId: string;
  studentId: string;
  tutorId?: string | null;
  tutorEmail?: string | null;
  mode?: string | null;
  planType: CreatablePlanType;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountReason?: string | null;
  actor: string;
};

export type RenewPlanArgs = {
  oldPlanId: string;
  newPlanType: RenewablePlanType;
  carryOverSessions?: number;
  mode?: string | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountReason?: string | null;
  actor: string;
};

async function readPackagePricing(tx: FirebaseFirestore.Transaction, db: Firestore, planType: "package_5" | "package_10") {
  const pricingSnap = await tx.get(db.collection("settings").doc("packagePricing"));
  if (!pricingSnap.exists) {
    throw new Error("Package pricing is not configured yet — set it on the Settings page first.");
  }
  const data = pricingSnap.data() ?? {};
  const standardPriceCents = planType === "package_10" ? Number(data.package10PriceCents) : Number(data.package5PriceCents);
  if (!Number.isFinite(standardPriceCents) || standardPriceCents <= 0) {
    throw new Error("Package pricing is misconfigured — check the Settings page.");
  }
  return standardPriceCents;
}

export async function createPlan(db: Firestore, args: CreatePlanArgs) {
  const { clientId, studentId, planType } = args;
  if (!clientId || !studentId) throw new Error("clientId and studentId are required.");
  if (!["casual", "package_5", "package_10"].includes(planType)) {
    throw new Error('planType must be "casual", "package_5", or "package_10".');
  }
  const mode = normalizeMode(args.mode) as StudyroomMode;

  const studentRef = db.collection("students").doc(studentId);
  const clientRef = db.collection("clients").doc(clientId);
  const planRef = db.collection("plans").doc();
  const entitlementRef = db.collection("entitlements").doc(planRef.id);

  return db.runTransaction(async (tx) => {
    const [studentSnap, clientSnap] = await Promise.all([tx.get(studentRef), tx.get(clientRef)]);
    if (!studentSnap.exists) throw new Error("Student not found.");
    if (!clientSnap.exists) throw new Error("Client not found.");
    const studentName = String((studentSnap.data() as { studentName?: string })?.studentName ?? "Student");
    const tutorId = args.tutorId ?? (studentSnap.data() as { assignedTutorId?: string })?.assignedTutorId ?? null;
    const tutorEmail = args.tutorEmail ?? (studentSnap.data() as { assignedTutorEmail?: string })?.assignedTutorEmail ?? null;

    const now = new Date();
    const termId = inferTermId(now);

    if (planType === "casual") {
      tx.set(planRef, {
        clientId,
        studentId,
        tutorId,
        tutorEmail,
        type: "casual",
        mode,
        status: "active",
        termId,
        sessionRateCents: getDefaultSessionRateCents(mode),
        packagePriceCents: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Multi-student-family correction: activePlanId is written on the
      // STUDENT only. A client/family can have several students, each with
      // their own plan — writing this onto the client doc too would make it
      // point at whichever student's plan was created/renewed most recently,
      // clobbering any sibling's. See clientTutorSync.ts's header comment for
      // the equivalent correction on assignedTutorId.
      tx.set(studentRef, { activePlanId: planRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { planId: planRef.id, entitlementId: null, invoiceId: null, finalPriceCents: null };
    }

    const standardPriceCents = await readPackagePricing(tx, db, planType);
    const discount = computeDiscount({
      standardPriceCents,
      discountType: args.discountType ?? null,
      discountValue: args.discountValue ?? null,
    });
    const seed = getEntitlementSeed(planType);

    tx.set(planRef, {
      clientId,
      studentId,
      tutorId,
      tutorEmail,
      type: planType,
      mode,
      status: "active",
      termId,
      sessionRateCents: getDefaultSessionRateCents(mode),
      packagePriceCents: null,
      standardPriceCents,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountAmountCents: discount.discountAmountCents,
      finalPriceCents: discount.finalPriceCents,
      discountReason: args.discountReason || null,
      discountAppliedBy: discount.discountType ? args.actor : null,
      discountAppliedAt: discount.discountType ? FieldValue.serverTimestamp() : null,
      pricingSnapshotAt: FieldValue.serverTimestamp(),
      carryOverSessions: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(entitlementRef, {
      planId: planRef.id,
      tutorId,
      tutorEmail,
      remainingSessions: seed.remainingSessions,
      bonusRemaining: seed.bonusRemaining,
      termId,
      bonusNonTransferable: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Student-level only — see the casual branch above for why.
    tx.set(studentRef, { activePlanId: planRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const invoiceRef = db.collection("invoices").doc();
    const issuedAt = now;
    const dueAt = addDays(issuedAt, CASUAL_INVOICE_DUE_DAYS);
    tx.set(invoiceRef, {
      invoiceKind: "package_purchase",
      planId: planRef.id,
      clientId,
      studentId,
      tutorId,
      tutorEmail,
      planType,
      mode,
      issuedAt: Timestamp.fromDate(issuedAt),
      dueAt: Timestamp.fromDate(dueAt),
      status: "pending_xero",
      lateFeeApplied: false,
      lateFeeCents: 0,
      amountCents: discount.finalPriceCents,
      balanceCents: discount.finalPriceCents,
      lineItems: buildPackageInvoiceLineItems({ planType, studentName, standardPriceCents, discountAmountCents: discount.discountAmountCents }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { planId: planRef.id, entitlementId: entitlementRef.id, invoiceId: invoiceRef.id, finalPriceCents: discount.finalPriceCents };
  });
}

export type CorrectEntitlementBalanceArgs = {
  planId: string;
  delta: number;
  reason: string;
  actor: string;
};

/**
 * Release 1B addendum: an explicit administrative correction to a package's
 * remaining-session balance (e.g. a session was booked/completed incorrectly,
 * or a credit needs restoring). This never rewrites or backdates session
 * history — it is its own visible, attributable event, recorded permanently
 * in entitlements/{planId}/corrections, separate from the balance it adjusts.
 */
export async function correctEntitlementBalance(db: Firestore, args: CorrectEntitlementBalanceArgs) {
  const { planId, actor } = args;
  if (!planId) throw new Error("planId is required.");
  const delta = Number(args.delta);
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    throw new Error("delta must be a non-zero whole number.");
  }
  const reason = String(args.reason ?? "").trim();
  if (!reason) throw new Error("A reason is required for a balance correction.");

  const entitlementRef = db.collection("entitlements").doc(planId);
  const correctionRef = entitlementRef.collection("corrections").doc();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(entitlementRef);
    if (!snap.exists) throw new Error("No entitlement found for this package.");
    const previousRemainingSessions = Number((snap.data() as { remainingSessions?: number })?.remainingSessions ?? 0);
    const newRemainingSessions = previousRemainingSessions + delta;
    if (newRemainingSessions < 0) {
      throw new Error(`This correction would result in a negative balance (${newRemainingSessions}), which is not allowed.`);
    }

    tx.set(entitlementRef, { remainingSessions: newRemainingSessions, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(correctionRef, {
      delta,
      reason,
      previousRemainingSessions,
      newRemainingSessions,
      correctedBy: actor,
      correctedAt: FieldValue.serverTimestamp(),
    });

    return { planId, previousRemainingSessions, newRemainingSessions, delta, correctionId: correctionRef.id };
  });
}

export async function renewPlan(db: Firestore, args: RenewPlanArgs) {
  const { oldPlanId, newPlanType } = args;
  if (!oldPlanId) throw new Error("oldPlanId is required.");
  if (!["package_5", "package_10"].includes(newPlanType)) {
    throw new Error('newPlanType must be "package_5" or "package_10".');
  }
  const requestedCarryOver = Number(args.carryOverSessions ?? 0);
  if (!Number.isFinite(requestedCarryOver) || !Number.isInteger(requestedCarryOver) || requestedCarryOver < 0) {
    throw new Error("carryOverSessions must be a whole number of 0 or more.");
  }

  const oldPlanRef = db.collection("plans").doc(oldPlanId);
  const oldEntitlementRef = db.collection("entitlements").doc(oldPlanId);
  const newPlanRef = db.collection("plans").doc();
  const newEntitlementRef = db.collection("entitlements").doc(newPlanRef.id);

  return db.runTransaction(async (tx) => {
    const [oldPlanSnap, oldEntitlementSnap] = await Promise.all([tx.get(oldPlanRef), tx.get(oldEntitlementRef)]);
    if (!oldPlanSnap.exists) throw new Error("The package being renewed was not found.");
    const oldPlan = oldPlanSnap.data() as {
      type?: string;
      clientId?: string;
      studentId?: string;
      tutorId?: string | null;
      tutorEmail?: string | null;
      mode?: string;
    };

    if (oldPlan.type !== "package_5" && oldPlan.type !== "package_10") {
      throw new Error(
        oldPlan.type === "package_12"
          ? "This is a legacy 12-session package and is outside the current package system — it cannot be renewed through this flow."
          : 'Only an existing "package_5" or "package_10" plan can be renewed. For a family\'s first package, use plan creation instead.'
      );
    }
    if (!oldEntitlementSnap.exists) throw new Error("No entitlement found for the package being renewed.");
    const oldRemaining = Number((oldEntitlementSnap.data() as { remainingSessions?: number })?.remainingSessions ?? 0);
    if (requestedCarryOver > oldRemaining) {
      throw new Error(`Carry-over (${requestedCarryOver}) cannot exceed the old package's actual remaining balance (${oldRemaining}).`);
    }

    const clientId = String(oldPlan.clientId ?? "");
    const studentId = String(oldPlan.studentId ?? "");
    if (!clientId || !studentId) throw new Error("The package being renewed is missing clientId/studentId.");

    const studentRef = db.collection("students").doc(studentId);
    const clientRef = db.collection("clients").doc(clientId);
    const [studentSnap, clientSnap] = await Promise.all([tx.get(studentRef), tx.get(clientRef)]);
    if (!studentSnap.exists) throw new Error("Student not found.");
    if (!clientSnap.exists) throw new Error("Client not found.");
    const studentName = String((studentSnap.data() as { studentName?: string })?.studentName ?? "Student");

    const standardPriceCents = await readPackagePricing(tx, db, newPlanType);
    const discount = computeDiscount({
      standardPriceCents,
      discountType: args.discountType ?? null,
      discountValue: args.discountValue ?? null,
    });

    const mode = normalizeMode(args.mode ?? oldPlan.mode);
    const tutorId = oldPlan.tutorId ?? null;
    const tutorEmail = oldPlan.tutorEmail ?? null;
    const now = new Date();
    const termId = inferTermId(now);
    const seed = getEntitlementSeed(newPlanType);

    tx.set(oldPlanRef, { status: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    tx.set(newPlanRef, {
      clientId,
      studentId,
      tutorId,
      tutorEmail,
      type: newPlanType,
      mode,
      status: "active",
      termId,
      sessionRateCents: getDefaultSessionRateCents(mode),
      packagePriceCents: null,
      standardPriceCents,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountAmountCents: discount.discountAmountCents,
      finalPriceCents: discount.finalPriceCents,
      discountReason: args.discountReason || null,
      discountAppliedBy: discount.discountType ? args.actor : null,
      discountAppliedAt: discount.discountType ? FieldValue.serverTimestamp() : null,
      pricingSnapshotAt: FieldValue.serverTimestamp(),
      renewedFromPlanId: oldPlanId,
      carryOverSessions: requestedCarryOver,
      carryOverApprovedBy: args.actor,
      carryOverApprovedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(newEntitlementRef, {
      planId: newPlanRef.id,
      tutorId,
      tutorEmail,
      remainingSessions: seed.remainingSessions + requestedCarryOver,
      bonusRemaining: seed.bonusRemaining,
      termId,
      bonusNonTransferable: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Student-level only — a sibling's plan/activePlanId must never change
    // because this student renewed theirs.
    tx.set(studentRef, { activePlanId: newPlanRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const invoiceRef = db.collection("invoices").doc();
    const issuedAt = now;
    const dueAt = addDays(issuedAt, CASUAL_INVOICE_DUE_DAYS);
    tx.set(invoiceRef, {
      invoiceKind: "package_purchase",
      planId: newPlanRef.id,
      clientId,
      studentId,
      tutorId,
      tutorEmail,
      planType: newPlanType,
      mode,
      issuedAt: Timestamp.fromDate(issuedAt),
      dueAt: Timestamp.fromDate(dueAt),
      status: "pending_xero",
      lateFeeApplied: false,
      lateFeeCents: 0,
      amountCents: discount.finalPriceCents,
      balanceCents: discount.finalPriceCents,
      lineItems: buildPackageInvoiceLineItems({ planType: newPlanType, studentName, standardPriceCents, discountAmountCents: discount.discountAmountCents }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      oldPlanId,
      newPlanId: newPlanRef.id,
      entitlementId: newEntitlementRef.id,
      invoiceId: invoiceRef.id,
      finalPriceCents: discount.finalPriceCents,
      carryOverSessions: requestedCarryOver,
    };
  });
}
