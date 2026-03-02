export const SESSION_DURATION_MINS = 60;
export const CASUAL_INVOICE_DUE_DAYS = 3;
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
export type InvoiceStatus = "sent" | "paid" | "overdue" | "void" | "credited" | "waived";

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
