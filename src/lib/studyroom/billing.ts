export const SESSION_DURATION_MINS = 60;
export const CASUAL_INVOICE_DUE_DAYS = 3;

// ---------------------------------------------------------------------------
// Casual pricing — Release 1A, Stage 3
//
// Price is locked to whatever was in effect on the session's ORIGINAL booked
// service date (sessions.originalStartAt, set once at creation and never
// modified by reschedule) — never the mutable startAt, never the completion
// date, never the invoice-processing date. Rescheduling a session across the
// effective-date boundary does not change its price.
//
// Only "in_home" and "online" have a rate. Production data (audited directly,
// 47/47 real session documents) confirms zero sessions have ever used
// mode/modality "group" — new group sessions and new group plans are
// prohibited going forward (enforced at Firestore create-rule level and in
// the plan-selection UI), so no "group rate" is introduced here at all. If a
// casual invoice is ever attempted for a session whose mode isn't one of
// these two, that is treated as an anomaly and rejected rather than silently
// priced — see the call site in serverBilling.ts.
// ---------------------------------------------------------------------------

export type CasualBillableMode = "in_home" | "online";

// PRICING_EFFECTIVE_DATE is the one constant to change for the current
// cutover — a Brisbane calendar date, "YYYY-MM-DD". Changing it before
// deployment requires no migration and no other code change: every call site
// reads it (directly or via CASUAL_PRICING_TIERS below), nothing duplicates
// the literal, and it only affects sessions whose originalStartAt hasn't been
// locked in yet (see serverBilling.ts — completed sessions are never
// recalculated regardless of this value).
export const PRICING_EFFECTIVE_DATE = "2026-10-06"; // Queensland school Term 4 start

export type CasualPricingTier = {
  /** Brisbane calendar date ("YYYY-MM-DD") this tier's rates apply from, inclusive. */
  effectiveFrom: string;
  rates: Record<CasualBillableMode, number>;
};

const LEGACY_CASUAL_RATES_CENTS: Record<CasualBillableMode, number> = {
  in_home: 7500,
  online: 6000,
};

const CURRENT_CASUAL_RATES_CENTS: Record<CasualBillableMode, number> = {
  in_home: 9000,
  online: 7500,
};

// Ordered oldest -> newest. A future price change is a NEW entry appended
// here (with its own new rate constant and its own new effectiveFrom date) —
// existing entries are never edited or deleted. This is what guarantees a
// session whose originalStartAt already fell into an earlier tier can never
// retroactively shift to a later tier's rate: the tier a booking resolves to
// is purely a function of its own fixed originalStartAt against this fixed
// list, never of anything that changes later.
const CASUAL_PRICING_TIERS: readonly CasualPricingTier[] = [
  { effectiveFrom: "2000-01-01", rates: LEGACY_CASUAL_RATES_CENTS },
  { effectiveFrom: PRICING_EFFECTIVE_DATE, rates: CURRENT_CASUAL_RATES_CENTS },
];

// Queensland does not observe daylight saving time, so Australia/Brisbane is a
// fixed UTC+10 offset year-round — no timezone library or DST logic is needed.
// Constructing each boundary with an explicit "+10:00" offset (rather than
// letting a bare date string be parsed as UTC) is what avoids the ~10-hour
// date-shift error that would otherwise misclassify early-morning sessions on
// a cutover date.
function tierInstantMs(effectiveFrom: string): number {
  return Date.parse(`${effectiveFrom}T00:00:00+10:00`);
}

export function isCasualBillableMode(mode: unknown): mode is CasualBillableMode {
  return mode === "in_home" || mode === "online";
}

/**
 * The rate for a casual session, determined solely by its original booked
 * service date against the ordered tier list above. `bookedAt` must be the
 * session's locked originalStartAt (or, only for a pre-existing session that
 * predates this field, its current startAt as the best available fallback) —
 * never `new Date()`, never a completion or invoice timestamp.
 */
export function getSessionRateCents(mode: CasualBillableMode, bookedAt: Date): number {
  const bookedMs = bookedAt.getTime();
  let applicable = CASUAL_PRICING_TIERS[0];
  for (const tier of CASUAL_PRICING_TIERS) {
    if (bookedMs >= tierInstantMs(tier.effectiveFrom)) {
      applicable = tier;
    } else {
      break;
    }
  }
  return applicable.rates[mode];
}

export const CASUAL_RATES = {
  standard: 7500,     // $75.00 in cents
  backToBack: 6000,   // $60.00 — consecutive sessions, gap ≤ 15 min
  sameTime: 4000,     // $40.00 — overlapping sessions
} as const;

export type CasualRateType = "standard" | "backToBack" | "sameTime";
export const WITHDRAWAL_NOTICE_DAYS = 14;
export const LATE_CANCELLATION_HOURS = 24;
export const LATE_FEE_GRACE_DAYS = 7;
export const LATE_FEE_CENTS = 500;

export type StudyroomPlanType = "casual" | "package_5" | "package_12";
export type StudyroomMode = "in_home" | "online" | "group";
export type StudyroomSessionStatus =
  | "scheduled"
  | "completed"
  | "cancelled_by_parent"
  | "cancelled_by_tutor"
  | "no_show";
export type BillingOutcome = "consume_entitlement" | "invoice" | "no_charge" | "credit";
export type InvoiceStatus = "pending_xero" | "draft_created" | "approved" | "sent" | "paid" | "overdue" | "void" | "credited" | "waived" | "xero_failed";

export type StudyroomPlanRecord = {
  id?: string;
  clientId?: string | null;
  studentId?: string | null;
  tutorId?: string | null;
  tutorEmail?: string | null;
  type: StudyroomPlanType;
  mode: StudyroomMode;
  status?: "active" | "paused" | "pending_withdrawal" | "withdrawn";
  termId?: string | null;
  sessionRateCents: number;
  packagePriceCents?: number | null;
  graceUsedThisTerm?: boolean;
  graceTermId?: string | null;
};

export type StudyroomEntitlementRecord = {
  id?: string;
  planId: string;
  tutorId?: string | null;
  tutorEmail?: string | null;
  remainingSessions: number;
  bonusRemaining: number;
  termId: string;
  expiresAt?: Date | null;
  bonusNonTransferable: true;
};

export type ComputeBillingOutcomeArgs = {
  sessionStatus: StudyroomSessionStatus;
  planType: StudyroomPlanType;
  noticeHours?: number | null;
  graceApplied?: boolean | null;
};

export function normalizePlanType(value: unknown): StudyroomPlanType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "package_5") return "package_5";
  if (raw === "package_12") return "package_12";
  return "casual";
}

export function normalizeMode(value: unknown): StudyroomMode {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "online") return "online";
  if (raw === "group") return "group";
  return "in_home";
}

export function normalizeSessionStatus(value: unknown): StudyroomSessionStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "completed") return "completed";
  if (raw === "cancelled_by_parent" || raw === "cancelled_parent") return "cancelled_by_parent";
  if (raw === "cancelled_by_tutor" || raw === "cancelled_studyroom") return "cancelled_by_tutor";
  if (raw === "no_show") return "no_show";
  return "scheduled";
}

export function toLegacySessionStatus(status: StudyroomSessionStatus) {
  if (status === "completed") return "COMPLETED";
  if (status === "cancelled_by_parent") return "CANCELLED_PARENT";
  if (status === "cancelled_by_tutor") return "CANCELLED_STUDYROOM";
  if (status === "no_show") return "NO_SHOW";
  return "SCHEDULED";
}

export function isPrepaidPlan(planType: StudyroomPlanType) {
  return planType === "package_5" || planType === "package_12";
}

export function getDefaultSessionRateCents(mode: StudyroomMode) {
  if (mode === "online") return 6000;
  if (mode === "group") return 4500;
  return 7500;
}

export function getEntitlementSeed(planType: StudyroomPlanType) {
  if (planType === "package_12") {
    return { remainingSessions: 10, bonusRemaining: 2 };
  }
  if (planType === "package_5") {
    return { remainingSessions: 5, bonusRemaining: 0 };
  }
  return { remainingSessions: 0, bonusRemaining: 0 };
}

export function inferTermId(at: Date) {
  const month = at.getMonth();
  const year = at.getFullYear();
  const term = month <= 2 ? 1 : month <= 5 ? 2 : month <= 8 ? 3 : 4;
  return `${year}-T${term}`;
}

export function computeNoticeHours(startTime: Date, cancelledAt?: Date | null) {
  if (!cancelledAt) return null;
  return Number(((startTime.getTime() - cancelledAt.getTime()) / 3600000).toFixed(2));
}

export function computeBillingOutcome(args: ComputeBillingOutcomeArgs): BillingOutcome {
  const graceApplied = args.graceApplied === true;
  const noticeHours = args.noticeHours ?? null;
  const prepaid = isPrepaidPlan(args.planType);

  if (args.sessionStatus === "cancelled_by_tutor") {
    return "credit";
  }

  if (args.sessionStatus === "completed") {
    return prepaid ? "consume_entitlement" : "invoice";
  }

  if (args.sessionStatus === "cancelled_by_parent") {
    if (graceApplied) return "no_charge";
    if (noticeHours !== null && noticeHours >= LATE_CANCELLATION_HOURS) return "no_charge";
    return prepaid ? "consume_entitlement" : "invoice";
  }

  if (args.sessionStatus === "no_show") {
    if (graceApplied) return "no_charge";
    return prepaid ? "consume_entitlement" : "invoice";
  }

  return "no_charge";
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

export function isInvoiceOverdue(invoice: {
  status?: string | null;
  dueAt?: Date | null;
  lateFeeApplied?: boolean | null;
}) {
  if (!invoice.dueAt) return false;
  if (invoice.status === "paid" || invoice.status === "void" || invoice.status === "credited") {
    return false;
  }
  return Date.now() > addDays(invoice.dueAt, LATE_FEE_GRACE_DAYS).getTime();
}

export function formatPlanLabel(planType: StudyroomPlanType) {
  if (planType === "package_5") return "5-session package";
  if (planType === "package_12") return "12-session package";
  return "Casual";
}

export function formatModeLabel(mode: StudyroomMode) {
  if (mode === "online") return "Online";
  if (mode === "group") return "Group";
  return "In-home";
}

export function formatSessionStatusLabel(status: StudyroomSessionStatus) {
  if (status === "completed") return "Completed";
  if (status === "cancelled_by_parent") return "Cancelled by parent";
  if (status === "cancelled_by_tutor") return "Cancelled by tutor";
  if (status === "no_show") return "No-show";
  return "Scheduled";
}
