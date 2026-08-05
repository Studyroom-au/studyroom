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
import { extractModePriceCents, type PackageModeForPricing } from "@/lib/studyroom/packagePricing";

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

function packageModeForPricing(mode: StudyroomMode): PackageModeForPricing {
  // Packages are only ever sold in-home or online (never "group") — see the
  // "group" comment in serverBilling.ts for the same production-confirmed
  // constraint on casual sessions. Reject rather than silently pick a mode's
  // price, since guessing here could bill the wrong amount.
  if (mode === "group") {
    throw new Error('Packages must be "in_home" or "online" — "group" is not a valid package mode.');
  }
  return mode;
}

async function readPackagePricing(
  tx: FirebaseFirestore.Transaction,
  db: Firestore,
  planType: "package_5" | "package_10",
  mode: StudyroomMode
) {
  const pricingSnap = await tx.get(db.collection("settings").doc("packagePricing"));
  if (!pricingSnap.exists) {
    throw new Error("Package pricing is not configured yet — set it on the Settings page first.");
  }
  return extractModePriceCents(pricingSnap.data() ?? {}, planType, packageModeForPricing(mode));
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

    const standardPriceCents = await readPackagePricing(tx, db, planType, mode);
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

    const mode = normalizeMode(args.mode ?? oldPlan.mode);
    const standardPriceCents = await readPackagePricing(tx, db, newPlanType, mode);
    const discount = computeDiscount({
      standardPriceCents,
      discountType: args.discountType ?? null,
      discountValue: args.discountValue ?? null,
    });

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

// ─────────────────────────────────────────────────────────────────────────
// Release 1B.1: Change arrangement — the one place a student's arrangement
// moves OFF Casual (or off the legacy package_12 system) onto a current
// package, or onto Casual for the first time. Distinct from renewPlan()
// above, which is only for an EXISTING package_5/package_10 renewing into
// another package_5/package_10 (carry-over sourced from that package's own
// entitlement). This function's two supported source shapes are mechanically
// different from a renewal:
//   - Casual (or no plan at all): no prior entitlement exists. Sessions
//     already delivered under the new package agreement before it was
//     entered were billed casually already (separate, already-existing
//     invoices) — `sessionsAlreadyCompleted` only ever reduces the STARTING
//     balance of the brand-new entitlement; it never touches, relinks, or
//     re-bills any historical session document.
//   - Legacy package_12: a real entitlement already exists. `carryOverSessions`
//     (capped at that entitlement's actual remaining balance, exactly like
//     renewPlan's carry-over) moves the unused legacy balance across.
// Exactly one of these two adjustments is ever meaningful for a given
// source; the other must be 0 (enforced below) so it's structurally
// impossible to double-count "already completed" against "carried over".
// ─────────────────────────────────────────────────────────────────────────

export type ArrangementTargetType = "casual" | "package_5" | "package_10";

export type ChangeArrangementArgs = {
  studentId: string;
  targetPlanType: ArrangementTargetType;
  mode?: string | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountReason?: string | null;
  /** Backdatable — when the agreement actually started. Defaults to now. */
  commencementAt?: Date | null;
  /** Only meaningful when the source arrangement is Casual or no plan. */
  sessionsAlreadyCompleted?: number;
  /** Only meaningful when the source arrangement is a legacy package_12. */
  carryOverSessions?: number;
  /** Required — why this arrangement is changing (audit trail). */
  reason: string;
  actor: string;
};

export async function changeArrangement(db: Firestore, args: ChangeArrangementArgs) {
  const { studentId, targetPlanType } = args;
  if (!studentId) throw new Error("studentId is required.");
  if (!["casual", "package_5", "package_10"].includes(targetPlanType)) {
    throw new Error('targetPlanType must be "casual", "package_5", or "package_10".');
  }
  const reason = String(args.reason ?? "").trim();
  if (!reason) throw new Error("A reason is required for an arrangement change.");

  const sessionsAlreadyCompleted = Number(args.sessionsAlreadyCompleted ?? 0);
  if (!Number.isFinite(sessionsAlreadyCompleted) || !Number.isInteger(sessionsAlreadyCompleted) || sessionsAlreadyCompleted < 0) {
    throw new Error("sessionsAlreadyCompleted must be a non-negative whole number.");
  }
  const carryOverSessions = Number(args.carryOverSessions ?? 0);
  if (!Number.isFinite(carryOverSessions) || !Number.isInteger(carryOverSessions) || carryOverSessions < 0) {
    throw new Error("carryOverSessions must be a non-negative whole number.");
  }
  if (sessionsAlreadyCompleted > 0 && carryOverSessions > 0) {
    throw new Error("Only one of sessionsAlreadyCompleted or carryOverSessions can be set for a single arrangement change.");
  }

  const studentRef = db.collection("students").doc(studentId);
  const newPlanRef = db.collection("plans").doc();
  const newEntitlementRef = db.collection("entitlements").doc(newPlanRef.id);

  return db.runTransaction(async (tx) => {
    const studentSnap = await tx.get(studentRef);
    if (!studentSnap.exists) throw new Error("Student not found.");
    const student = studentSnap.data() as {
      clientId?: string;
      studentName?: string;
      activePlanId?: string | null;
      assignedTutorId?: string | null;
      assignedTutorEmail?: string | null;
      mode?: string | null;
    };
    const clientId = String(student.clientId ?? "");
    if (!clientId) throw new Error("Student is missing clientId.");
    const studentName = String(student.studentName ?? "Student");

    const oldPlanId = student.activePlanId || null;
    const oldPlanRef = oldPlanId ? db.collection("plans").doc(oldPlanId) : null;
    const oldEntitlementRef = oldPlanId ? db.collection("entitlements").doc(oldPlanId) : null;
    const [oldPlanSnap, oldEntitlementSnap] = oldPlanRef
      ? await Promise.all([tx.get(oldPlanRef), tx.get(oldEntitlementRef!)])
      : [null, null];

    const oldPlan = oldPlanSnap?.exists ? (oldPlanSnap.data() as { type?: string; mode?: string }) : null;
    const oldType = oldPlan?.type ?? null;

    if (oldType === "package_5" || oldType === "package_10") {
      throw new Error(
        'This student already has an active "package_5" or "package_10" arrangement — use "Renew package" instead of "Change arrangement".'
      );
    }
    if (oldType && oldType !== "casual" && oldType !== "package_12") {
      throw new Error(`Cannot change arrangement from an unrecognized plan type "${oldType}".`);
    }

    const oldEntitlement = oldEntitlementSnap?.exists ? (oldEntitlementSnap.data() as { remainingSessions?: number }) : null;
    const oldRemaining = Number(oldEntitlement?.remainingSessions ?? 0);

    if (oldType === "package_12") {
      if (carryOverSessions > oldRemaining) {
        throw new Error(`Carry-over (${carryOverSessions}) cannot exceed the legacy package's actual remaining balance (${oldRemaining}).`);
      }
    } else if (carryOverSessions > 0) {
      throw new Error("carryOverSessions is only applicable when transitioning from a legacy package_12 arrangement.");
    }
    if (oldType !== "package_12" && sessionsAlreadyCompleted > 0) {
      // fine — casual/no-plan source, this is the expected place for it.
    } else if (oldType === "package_12" && sessionsAlreadyCompleted > 0) {
      throw new Error("sessionsAlreadyCompleted is not applicable when transitioning from a legacy package_12 arrangement — use carryOverSessions instead.");
    }

    const tutorId = student.assignedTutorId ?? null;
    const tutorEmail = student.assignedTutorEmail ?? null;
    const mode = normalizeMode(args.mode ?? oldPlan?.mode ?? student.mode);
    const now = new Date();
    const commencementAt = args.commencementAt ?? now;
    const termId = inferTermId(now);

    // All reads (including the package-pricing read, which itself does a
    // tx.get) must happen before any write in this transaction — read the
    // price up front, before expiring the old plan, even though it's only
    // used below in the non-casual branch.
    const standardPriceCents = targetPlanType === "casual" ? null : await readPackagePricing(tx, db, targetPlanType, mode);

    if (oldPlanRef) {
      tx.set(oldPlanRef, { status: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    if (targetPlanType === "casual") {
      tx.set(newPlanRef, {
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
        commencementAt: Timestamp.fromDate(commencementAt),
        changedFromPlanId: oldPlanId,
        arrangementChangedBy: args.actor,
        arrangementChangedAt: FieldValue.serverTimestamp(),
        arrangementChangeReason: reason,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(studentRef, { activePlanId: newPlanRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { oldPlanId, newPlanId: newPlanRef.id, entitlementId: null, invoiceId: null, finalPriceCents: null };
    }

    const resolvedStandardPriceCents = standardPriceCents!;
    const discount = computeDiscount({
      standardPriceCents: resolvedStandardPriceCents,
      discountType: args.discountType ?? null,
      discountValue: args.discountValue ?? null,
    });
    const seed = getEntitlementSeed(targetPlanType);

    if (sessionsAlreadyCompleted > seed.remainingSessions) {
      throw new Error(
        `Cannot mark ${sessionsAlreadyCompleted} session(s) as already completed — the new package only includes ${seed.remainingSessions} session(s).`
      );
    }
    const initialRemaining = seed.remainingSessions - sessionsAlreadyCompleted + carryOverSessions;

    tx.set(newPlanRef, {
      clientId,
      studentId,
      tutorId,
      tutorEmail,
      type: targetPlanType,
      mode,
      status: "active",
      termId,
      sessionRateCents: getDefaultSessionRateCents(mode),
      packagePriceCents: null,
      standardPriceCents: resolvedStandardPriceCents,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountAmountCents: discount.discountAmountCents,
      finalPriceCents: discount.finalPriceCents,
      discountReason: args.discountReason || null,
      discountAppliedBy: discount.discountType ? args.actor : null,
      discountAppliedAt: discount.discountType ? FieldValue.serverTimestamp() : null,
      pricingSnapshotAt: FieldValue.serverTimestamp(),
      commencementAt: Timestamp.fromDate(commencementAt),
      changedFromPlanId: oldPlanId,
      initialSessionsAlreadyCompleted: sessionsAlreadyCompleted,
      carryOverSessions,
      arrangementChangedBy: args.actor,
      arrangementChangedAt: FieldValue.serverTimestamp(),
      arrangementChangeReason: reason,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(newEntitlementRef, {
      planId: newPlanRef.id,
      tutorId,
      tutorEmail,
      remainingSessions: initialRemaining,
      bonusRemaining: seed.bonusRemaining,
      termId,
      bonusNonTransferable: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Student-level only — a sibling's plan/activePlanId must never change
    // because this student's arrangement changed.
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
      planType: targetPlanType,
      mode,
      issuedAt: Timestamp.fromDate(issuedAt),
      dueAt: Timestamp.fromDate(dueAt),
      status: "pending_xero",
      lateFeeApplied: false,
      lateFeeCents: 0,
      amountCents: discount.finalPriceCents,
      balanceCents: discount.finalPriceCents,
      lineItems: buildPackageInvoiceLineItems({ planType: targetPlanType, studentName, standardPriceCents: resolvedStandardPriceCents, discountAmountCents: discount.discountAmountCents }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      oldPlanId,
      newPlanId: newPlanRef.id,
      entitlementId: newEntitlementRef.id,
      invoiceId: invoiceRef.id,
      finalPriceCents: discount.finalPriceCents,
      initialRemainingSessions: initialRemaining,
    };
  });
}
