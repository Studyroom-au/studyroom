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
// Exported so it can be used as the seed/fallback for the Firestore-backed
// settings/casualPricingTiers doc (src/lib/studyroom/casualPricing.ts) — the
// hardcoded list here is never removed; it's what a missing/malformed
// Settings document safely falls back to, so a casual invoice can never
// silently price at $0.
export const CASUAL_PRICING_TIERS: readonly CasualPricingTier[] = [
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
 * service date against an ordered tier list. `bookedAt` must be the
 * session's locked originalStartAt (or, only for a pre-existing session that
 * predates this field, its current startAt as the best available fallback) —
 * never `new Date()`, never a completion or invoice timestamp.
 *
 * `tiers` defaults to the hardcoded CASUAL_PRICING_TIERS above so every
 * existing caller/test that doesn't pass a third argument is completely
 * unaffected. The Firestore-backed settings/casualPricingTiers tier list
 * (read once, OUTSIDE applySessionAction's transaction — see
 * src/lib/studyroom/casualPricing.ts) is passed in explicitly by callers that
 * want it; this function itself never touches Firestore, so it's still pure
 * and still independently unit-testable.
 */
export function getSessionRateCents(
  mode: CasualBillableMode,
  bookedAt: Date,
  tiers: readonly CasualPricingTier[] = CASUAL_PRICING_TIERS
): number {
  const bookedMs = bookedAt.getTime();
  let applicable = tiers[0];
  for (const tier of tiers) {
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

// Release 1B: current sellable packages are casual / package_5 / package_10
// (package_10 = exactly 10 sessions, no bonus). "package_12" is kept in the
// type solely to correctly read/bill the small number of pre-existing legacy
// 12-session plans (10 base + 2 bonus) that predate this change — it is never
// offered by any creation/renewal UI or route from this point forward, and
// must never be produced as a new value. See getEntitlementSeed/isPrepaidPlan
// below, which both still recognize it for that legacy-read reason only.
export type StudyroomPlanType = "casual" | "package_5" | "package_10" | "package_12";
export type StudyroomMode = "in_home" | "online" | "group";
export type StudyroomSessionStatus =
  | "scheduled"
  | "completed"
  | "cancelled_by_parent"
  | "cancelled_by_tutor"
  | "no_show";
export type BillingOutcome = "consume_entitlement" | "invoice" | "no_charge" | "credit";
export type InvoiceStatus = "pending_xero" | "draft_created" | "approved" | "sent" | "paid" | "overdue" | "void" | "credited" | "waived" | "xero_failed";

// Release 1B: package pricing/discount. A discount is exactly one of these
// two shapes, never both — enforced structurally by computeDiscount() below
// taking a single discountType rather than two independent optional amounts.
export type DiscountType = "percent" | "fixed";

export type StudyroomPlanRecord = {
  id?: string;
  clientId?: string | null;
  studentId?: string | null;
  tutorId?: string | null;
  tutorEmail?: string | null;
  type: StudyroomPlanType;
  mode: StudyroomMode;
  status?: "active" | "paused" | "pending_withdrawal" | "withdrawn" | "expired";
  termId?: string | null;
  sessionRateCents: number;
  packagePriceCents?: number | null;
  graceUsedThisTerm?: boolean;
  graceTermId?: string | null;

  // Release 1B — package commercial snapshot, set once at creation/renewal
  // and never recomputed later (mirrors originalStartAt's pricing-lock
  // guarantee for casual sessions). Only meaningful for package_5/package_10
  // plans created via /api/plans/create or /api/plans/renew.
  standardPriceCents?: number | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountAmountCents?: number | null;
  finalPriceCents?: number | null;
  discountReason?: string | null;
  discountAppliedBy?: string | null;
  discountAppliedAt?: unknown; // Firestore Timestamp — kept as unknown here to avoid an admin-SDK import in this pure module
  pricingSnapshotAt?: unknown;

  // Release 1B — renewal lineage, set only on a plan created by /api/plans/renew.
  renewedFromPlanId?: string | null;
  carryOverSessions?: number;
  carryOverApprovedBy?: string | null;
  carryOverApprovedAt?: unknown;
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
  if (raw === "package_10") return "package_10";
  // Legacy-read only — no current code path ever writes this value.
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
  // package_12 stays prepaid so the existing legacy plans keep consuming
  // entitlements correctly instead of silently flipping to casual invoicing.
  return planType === "package_5" || planType === "package_10" || planType === "package_12";
}

export function getDefaultSessionRateCents(mode: StudyroomMode) {
  if (mode === "online") return 6000;
  if (mode === "group") return 4500;
  return 7500;
}

export function getEntitlementSeed(planType: StudyroomPlanType) {
  if (planType === "package_10") {
    return { remainingSessions: 10, bonusRemaining: 0 };
  }
  // Legacy-read only (see StudyroomPlanType) — kept so hydratePlanContext can
  // still correctly backfill a missing entitlement for a pre-existing
  // package_12 plan; never selected by any current creation/renewal path.
  if (planType === "package_12") {
    return { remainingSessions: 10, bonusRemaining: 2 };
  }
  if (planType === "package_5") {
    return { remainingSessions: 5, bonusRemaining: 0 };
  }
  return { remainingSessions: 0, bonusRemaining: 0 };
}

export type DiscountInput = {
  standardPriceCents: number;
  discountType?: DiscountType | null;
  discountValue?: number | null;
};

export type DiscountResult = {
  discountType: DiscountType | null;
  discountValue: number | null;
  discountAmountCents: number;
  finalPriceCents: number;
};

/**
 * Release 1B: the one place a package discount is ever computed. Pure,
 * snapshot-friendly (no clock, no external read) — the caller writes the
 * returned fields directly onto the specific plan document, once, at
 * creation/renewal time. Throws on an invalid shape rather than silently
 * clamping, since this always represents a real commercial decision.
 */
export function computeDiscount(input: DiscountInput): DiscountResult {
  const { standardPriceCents } = input;
  if (!Number.isFinite(standardPriceCents) || standardPriceCents < 0) {
    throw new Error("standardPriceCents must be a non-negative number.");
  }

  const discountType = input.discountType ?? null;
  if (discountType === null) {
    return { discountType: null, discountValue: null, discountAmountCents: 0, finalPriceCents: standardPriceCents };
  }

  const discountValue = Number(input.discountValue);
  if (!Number.isFinite(discountValue)) {
    throw new Error("discountValue must be a number when discountType is set.");
  }

  if (discountType === "percent") {
    if (discountValue < 0 || discountValue > 100) {
      throw new Error("A percentage discount must be between 0 and 100.");
    }
    const discountAmountCents = Math.round((standardPriceCents * discountValue) / 100);
    return { discountType, discountValue, discountAmountCents, finalPriceCents: Math.max(0, standardPriceCents - discountAmountCents) };
  }

  if (discountType === "fixed") {
    if (discountValue < 0) {
      throw new Error("A fixed discount cannot be negative.");
    }
    const discountAmountCents = Math.round(discountValue);
    return { discountType, discountValue, discountAmountCents, finalPriceCents: Math.max(0, standardPriceCents - discountAmountCents) };
  }

  throw new Error(`Unknown discountType "${discountType}".`);
}

export type InvoiceLineItem = { description: string; quantity: number; unitAmount: number; accountCode?: string };

/**
 * Release 1B: the line items for a package-purchase invoice (creation or
 * renewal) — a base line at the full standard price, plus a separate,
 * clearly-labeled negative line for the discount if one applies. The base
 * rate itself is never altered, so the original standard price is always
 * visible on the invoice even when discounted, matching the discount design's
 * audit requirement.
 */
export function buildPackageInvoiceLineItems(args: {
  planType: StudyroomPlanType;
  studentName: string;
  standardPriceCents: number;
  discountAmountCents: number;
}): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [
    {
      description: `${formatPlanLabel(args.planType)} — ${args.studentName}`,
      quantity: 1,
      unitAmount: Number((args.standardPriceCents / 100).toFixed(2)),
    },
  ];
  if (args.discountAmountCents > 0) {
    items.push({
      description: "Discount",
      quantity: 1,
      unitAmount: -Number((args.discountAmountCents / 100).toFixed(2)),
    });
  }
  return items;
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

/**
 * Release 1B, Stage 7: which invoice statuses a manual "Mark as paid" action
 * must refuse — an invoice that's already void/credited/waived was never
 * actually charged (or was explicitly forgiven), so marking it "paid" would
 * misrepresent the family's real payment history.
 */
export function isMarkPaidBlocked(status: string): boolean {
  return status === "void" || status === "credited" || status === "waived";
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
  if (planType === "package_10") return "10-session package";
  if (planType === "package_12") return "12-session package (legacy)";
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
