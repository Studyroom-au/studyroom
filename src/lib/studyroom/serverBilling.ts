import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  CASUAL_INVOICE_DUE_DAYS,
  LATE_FEE_CENTS,
  computeBillingOutcome,
  computeNoticeHours,
  formatModeLabel,
  formatPlanLabel,
  getDefaultSessionRateCents,
  getEntitlementSeed,
  inferTermId,
  isInvoiceOverdue,
  isPrepaidPlan,
  normalizeMode,
  normalizePlanType,
  normalizeSessionStatus,
  toLegacySessionStatus,
  type BillingOutcome,
  type InvoiceStatus,
  type StudyroomEntitlementRecord,
  type StudyroomMode,
  type StudyroomPlanRecord,
  type StudyroomPlanType,
  type StudyroomSessionStatus,
} from "@/lib/studyroom/billing";

type Role = "tutor" | "admin";

type RawSession = {
  tutorId?: string;
  tutorEmail?: string | null;
  studentId?: string;
  clientId?: string | null;
  planId?: string | null;
  startAt?: Timestamp;
  endAt?: Timestamp;
  durationMinutes?: number;
  mode?: string | null;
  modality?: string | null;
  status?: string | null;
  graceApplied?: boolean | null;
  cancelledAt?: Timestamp | null;
  noticeHours?: number | null;
  consumed?: boolean | null;
  consumedFrom?: "base" | "bonus" | null;
  invoiceId?: string | null;
  billingOutcome?: BillingOutcome | null;
  billingStatus?: string | null;
};

type RawStudent = {
  activePlanId?: string | null;
  package?: string | null;
  mode?: string | null;
};

type RawClient = {
  activePlanId?: string | null;
  pricingPlan?: string | null;
  package?: string | null;
  mode?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
};

type RawInvoice = {
  status?: InvoiceStatus | null;
  dueAt?: Timestamp | null;
  lateFeeApplied?: boolean | null;
  lateFeeCents?: number | null;
  balanceCents?: number | null;
};

type SessionAction = "complete" | "cancel_by_parent" | "cancel_by_tutor" | "no_show" | "apply_grace";

type ApplySessionActionArgs = {
  sessionId: string;
  action: SessionAction;
  user: DecodedIdToken;
  role: Role;
};

function assertPermitted(role: Role, userId: string, sessionTutorId?: string) {
  if (role === "admin") return;
  if (!sessionTutorId || sessionTutorId !== userId) {
    throw new Error("Not permitted.");
  }
}

function asDate(value?: Timestamp | null) {
  return value?.toDate ? value.toDate() : null;
}

function invoiceStatusFromOutcome(outcome: BillingOutcome): InvoiceStatus | null {
  if (outcome === "credit") return "credited";
  if (outcome === "no_charge") return "void";
  return null;
}

function isUnpaidInvoiceStatus(status?: InvoiceStatus | null) {
  return status === "sent" || status === "overdue";
}

async function hydratePlanContext(input: {
  tx: FirebaseFirestore.Transaction;
  sessionRef: FirebaseFirestore.DocumentReference;
  session: RawSession;
  now: Date;
}) {
  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");

  const studentId = String(input.session.studentId ?? "");
  const clientId = String(input.session.clientId ?? "");

  const studentRef = studentId ? db.collection("students").doc(studentId) : null;
  const clientRef = clientId ? db.collection("clients").doc(clientId) : null;

  const [studentSnap, clientSnap] = await Promise.all([
    studentRef ? input.tx.get(studentRef) : null,
    clientRef ? input.tx.get(clientRef) : null,
  ]);

  const student = (studentSnap?.data() ?? {}) as RawStudent;
  const client = (clientSnap?.data() ?? {}) as RawClient;

  const planId =
    String(input.session.planId ?? "") ||
    String(student.activePlanId ?? "") ||
    String(client.activePlanId ?? "");
  const planRef = planId ? db.collection("plans").doc(planId) : db.collection("plans").doc();
  const planSnap = planId ? await input.tx.get(planRef) : null;
  const entitlementRef = db.collection("entitlements").doc(planRef.id);
  const entitlementSnap = await input.tx.get(entitlementRef);

  const fallbackPlanType = normalizePlanType(student.package ?? client.pricingPlan ?? client.package);
  const fallbackMode = normalizeMode(input.session.mode ?? input.session.modality ?? student.mode ?? client.mode);
  const fallbackTermId = inferTermId(asDate(input.session.startAt) ?? input.now);
  const missingPlanData: StudyroomPlanRecord = {
    clientId: clientId || null,
    studentId: studentId || null,
    tutorId: input.session.tutorId ?? null,
    tutorEmail: input.session.tutorEmail ?? null,
    type: fallbackPlanType,
    mode: fallbackMode,
    status: "active",
    termId: fallbackTermId,
    sessionRateCents: getDefaultSessionRateCents(fallbackMode),
    packagePriceCents: null,
    graceUsedThisTerm: false,
    graceTermId: fallbackTermId,
  };

  const plan = planSnap?.exists
    ? ({ id: planRef.id, ...(planSnap.data() as StudyroomPlanRecord) } as StudyroomPlanRecord)
    : ({ id: planRef.id, ...missingPlanData } as StudyroomPlanRecord);

  if (!planSnap?.exists) {
    input.tx.set(planRef, {
      ...missingPlanData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      source: "legacy_backfill",
    });

    if (studentRef) {
      input.tx.set(studentRef, { activePlanId: planRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    if (clientRef) {
      input.tx.set(clientRef, { activePlanId: planRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }

  input.tx.set(
    planRef,
    {
      tutorId: input.session.tutorId ?? plan.tutorId ?? null,
      tutorEmail: input.session.tutorEmail ?? plan.tutorEmail ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  let entitlement: StudyroomEntitlementRecord | null = entitlementSnap.exists
    ? ({ id: entitlementRef.id, ...(entitlementSnap.data() as StudyroomEntitlementRecord) } as StudyroomEntitlementRecord)
    : null;
  if (!entitlementSnap.exists && isPrepaidPlan(normalizePlanType(plan.type))) {
    const seed = getEntitlementSeed(normalizePlanType(plan.type));
    entitlement = {
      id: entitlementRef.id,
      planId: planRef.id,
      tutorId: input.session.tutorId ?? null,
      tutorEmail: input.session.tutorEmail ?? null,
      remainingSessions: seed.remainingSessions,
      bonusRemaining: seed.bonusRemaining,
      termId: plan.termId ?? inferTermId(asDate(input.session.startAt) ?? input.now),
      bonusNonTransferable: true,
    };
    input.tx.set(entitlementRef, {
      ...entitlement,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (entitlement) {
    input.tx.set(
      entitlementRef,
      {
        tutorId: input.session.tutorId ?? entitlement.tutorId ?? null,
        tutorEmail: input.session.tutorEmail ?? entitlement.tutorEmail ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    student,
    client,
    studentRef,
    clientRef,
    plan,
    planRef,
    entitlement,
    entitlementRef,
  };
}

function buildInvoiceLine(args: {
  studentName?: string | null;
  mode: StudyroomMode;
  planType: StudyroomPlanType;
  amountCents: number;
  sessionId: string;
  status: StudyroomSessionStatus;
}) {
  const sessionLabel =
    args.status === "completed"
      ? "Tutoring session"
      : args.status === "no_show"
        ? "No-show session fee"
        : "Late cancellation fee";

  return {
    sessionId: args.sessionId,
    desc: `${sessionLabel} • ${args.studentName || "Student"} • ${formatModeLabel(args.mode)} • ${formatPlanLabel(args.planType)}`,
    amountCents: args.amountCents,
  };
}

export async function applySessionAction(args: ApplySessionActionArgs) {
  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");

  const sessionRef = db.collection("sessions").doc(args.sessionId);

  return await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new Error("Session not found.");
    }

    const session = (sessionSnap.data() ?? {}) as RawSession;
    assertPermitted(args.role, args.user.uid, session.tutorId);

    const now = new Date();
    const startAt = asDate(session.startAt);
    if (!startAt) {
      throw new Error("Session missing startAt.");
    }

    const ctx = await hydratePlanContext({ tx, sessionRef, session, now });
    const planType = normalizePlanType(ctx.plan.type);
    const mode = normalizeMode(session.mode ?? session.modality ?? ctx.plan.mode);
    const nextStatus: StudyroomSessionStatus =
      args.action === "complete"
        ? "completed"
        : args.action === "cancel_by_parent"
          ? "cancelled_by_parent"
          : args.action === "cancel_by_tutor"
            ? "cancelled_by_tutor"
            : args.action === "no_show"
              ? "no_show"
              : normalizeSessionStatus(session.status);

    const priorGraceApplied = session.graceApplied === true;
    const graceApplied = args.action === "apply_grace" ? true : priorGraceApplied;
    const cancelledAt =
      args.action === "cancel_by_parent" || args.action === "cancel_by_tutor"
        ? now
        : asDate(session.cancelledAt);
    const noticeHours =
      nextStatus === "cancelled_by_parent" ? computeNoticeHours(startAt, cancelledAt) : session.noticeHours ?? null;
    const outcome = computeBillingOutcome({
      sessionStatus: nextStatus,
      planType,
      noticeHours,
      graceApplied,
    });

    if (args.action === "apply_grace") {
      if (args.role !== "admin") {
        throw new Error("Only admin can apply grace.");
      }
      const currentStatus = normalizeSessionStatus(session.status);
      if (currentStatus !== "cancelled_by_parent" && currentStatus !== "no_show") {
        throw new Error("Grace can only be applied to forfeited parent cancellations or no-shows.");
      }
      tx.set(
        ctx.planRef,
        {
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const sessionPatch: Record<string, unknown> = {
      planId: ctx.planRef.id,
      mode,
      durationMins: Number(session.durationMinutes ?? 60),
      noticeHours,
      graceApplied,
      billingOutcome: outcome,
      status: nextStatus,
      legacyStatus: toLegacySessionStatus(nextStatus),
      billingStatus: outcome === "invoice" ? "INVOICED" : outcome === "consume_entitlement" ? "PREPAID" : outcome === "credit" ? "CREDITED" : "NOT_BILLED",
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (nextStatus === "completed") {
      sessionPatch.completedAt = FieldValue.serverTimestamp();
    }
    if (cancelledAt) {
      sessionPatch.cancelledAt = Timestamp.fromDate(cancelledAt);
    }

    const existingInvoiceId = String(session.invoiceId ?? "");
    const invoiceRef = existingInvoiceId ? db.collection("invoices").doc(existingInvoiceId) : db.collection("invoices").doc();
    const invoiceSnap = existingInvoiceId ? await tx.get(invoiceRef) : null;
  const invoice = (invoiceSnap?.data() ?? {}) as RawInvoice;

    const consumed = session.consumed === true;
    const consumedFrom = session.consumedFrom ?? null;
    if (outcome === "consume_entitlement") {
      if (!ctx.entitlement) {
        throw new Error("Entitlement not found for prepaid plan.");
      }
      if (!consumed) {
        const remainingSessions = Number(ctx.entitlement.remainingSessions ?? 0);
        const bonusRemaining = Number(ctx.entitlement.bonusRemaining ?? 0);
        if (remainingSessions > 0) {
          tx.set(
            ctx.entitlementRef,
            { remainingSessions: remainingSessions - 1, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          sessionPatch.consumedFrom = "base";
        } else if (bonusRemaining > 0) {
          tx.set(
            ctx.entitlementRef,
            { bonusRemaining: bonusRemaining - 1, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          sessionPatch.consumedFrom = "bonus";
        } else {
          throw new Error("No remaining entitlement balance.");
        }
      }
      sessionPatch.consumed = true;
      sessionPatch.invoiceId = null;
    } else {
      if (consumed && ctx.entitlement) {
        if (consumedFrom === "bonus") {
          tx.set(
            ctx.entitlementRef,
            { bonusRemaining: Number(ctx.entitlement.bonusRemaining ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        } else {
          tx.set(
            ctx.entitlementRef,
            { remainingSessions: Number(ctx.entitlement.remainingSessions ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }
      }
      sessionPatch.consumed = false;
      sessionPatch.consumedFrom = null;
    }

    if (outcome === "invoice") {
      const amountCents = Number(ctx.plan.sessionRateCents ?? getDefaultSessionRateCents(mode));
      const issuedAt = now;
      const dueAt = new Date(issuedAt.getTime() + CASUAL_INVOICE_DUE_DAYS * 86400000);
      const studentName = String((ctx.student as { studentName?: string | null }).studentName ?? "Student");
      const invoiceStatus: InvoiceStatus = isInvoiceOverdue({ dueAt, status: "sent", lateFeeApplied: false }) ? "overdue" : "sent";
      const invoiceDoc = {
        clientId: session.clientId ?? ctx.plan.clientId ?? null,
        studentId: session.studentId ?? ctx.plan.studentId ?? null,
        sessionId: sessionRef.id,
        planId: ctx.planRef.id,
        tutorId: session.tutorId ?? ctx.plan.tutorId ?? null,
        tutorEmail: session.tutorEmail ?? ctx.plan.tutorEmail ?? null,
        planType,
        mode,
        issuedAt: Timestamp.fromDate(issuedAt),
        dueAt: Timestamp.fromDate(dueAt),
        status: invoiceStatus,
        lateFeeApplied: false,
        lateFeeCents: 0,
        amountCents,
        balanceCents: amountCents,
        lineItems: [buildInvoiceLine({ studentName, mode, planType, amountCents, sessionId: sessionRef.id, status: nextStatus })],
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (invoiceSnap?.exists) {
        tx.set(invoiceRef, invoiceDoc, { merge: true });
      } else {
        tx.set(invoiceRef, { ...invoiceDoc, createdAt: FieldValue.serverTimestamp() });
      }

      sessionPatch.invoiceId = invoiceRef.id;
    } else if (existingInvoiceId && invoiceSnap?.exists) {
      if (args.action === "apply_grace" && isUnpaidInvoiceStatus(invoice.status)) {
        tx.set(
          invoiceRef,
          {
            status: "waived",
            balanceCents: 0,
            waivedReason: "grace",
            waivedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        sessionPatch.invoiceId = existingInvoiceId;
      }
      const status = invoiceStatusFromOutcome(outcome);
      if (status && !(args.action === "apply_grace" && isUnpaidInvoiceStatus(invoice.status))) {
        const dueAt = asDate(invoice.dueAt ?? null);
        const overdue = dueAt ? isInvoiceOverdue({ dueAt, status, lateFeeApplied: invoice.lateFeeApplied }) : false;
        tx.set(
          invoiceRef,
          {
            status: overdue && status === "sent" ? "overdue" : status,
            balanceCents: 0,
            lateFeeApplied:
              overdue && invoice.lateFeeApplied !== true && status !== "paid" && status !== "void" && status !== "credited"
                ? true
                : invoice.lateFeeApplied ?? false,
            lateFeeCents:
              overdue && invoice.lateFeeApplied !== true && status !== "paid" && status !== "void" && status !== "credited"
                ? LATE_FEE_CENTS
                : invoice.lateFeeCents ?? 0,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    tx.set(sessionRef, sessionPatch, { merge: true });

    return {
      ok: true,
      sessionId: sessionRef.id,
      status: nextStatus,
      billingOutcome: outcome,
      planType,
      mode,
      noticeHours,
      graceApplied,
      invoiceId: outcome === "invoice" ? invoiceRef.id : (sessionPatch.invoiceId ?? (existingInvoiceId || null)),
      entitlementRemaining: ctx.entitlement
        ? {
            remainingSessions:
              outcome === "consume_entitlement" && !consumed
                ? Math.max(0, Number(ctx.entitlement.remainingSessions ?? 0) - 1)
                : Number(ctx.entitlement.remainingSessions ?? 0),
            bonusRemaining: Number(ctx.entitlement.bonusRemaining ?? 0),
          }
        : null,
    };
  });
}
