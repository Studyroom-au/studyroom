// src/lib/studyroom/sessionExceptions.ts
// Single source of truth for "does this session need admin attention" — used
// by both the Operations Centre (hub/admin/page.tsx) and the Sessions
// oversight view (hub/admin/sessions/page.tsx). Do not reimplement either
// check in either place; a correctly-recorded cancellation, reschedule, or
// no-show is never an exception — only these two derived conditions are.

export const SESSION_OVERDUE_GRACE_MINUTES = 30;

/**
 * A session is "overdue scheduled" if it's still marked scheduled but its
 * end time (plus a grace window, in case of a slightly late status update)
 * has already passed. Never true for completed/cancelled/no-show sessions —
 * those are correctly recorded outcomes, not exceptions.
 */
export function isOverdueScheduled(
  status: string,
  startAt: Date,
  durationMinutes: number,
  now: Date,
  graceMinutes: number = SESSION_OVERDUE_GRACE_MINUTES
): boolean {
  if (status !== "scheduled") return false;
  const end = new Date(startAt.getTime() + durationMinutes * 60000);
  return now.getTime() > end.getTime() + graceMinutes * 60000;
}

/**
 * A completed session has a billing/outcome failure if billing never ran at
 * all (no billingOutcome recorded), or its linked invoice ended up stuck in
 * a failed Xero-push state.
 */
export function hasBillingOutcomeFailure(
  status: string,
  billingOutcome: string | null | undefined,
  invoiceStatus: string | null | undefined
): boolean {
  if (status !== "completed") return false;
  if (!billingOutcome) return true;
  if (billingOutcome === "invoice" && invoiceStatus === "xero_failed") return true;
  return false;
}

/**
 * Operations Cutover gate (final pre-release addition — see
 * operationsCutover.ts). A session is only eligible to generate a Needs
 * Attention exception under the new Release 1B rules if its current
 * scheduled date (startAt) is on or after the cutover. Older sessions
 * remain fully browseable as history; they just never (re-)trigger a
 * new-system exception, regardless of how the exception itself is computed.
 *
 * Deliberately NOT originalStartAt. originalStartAt is the pricing-lock
 * field — it freezes the *rate* a session was booked at and must never
 * move on reschedule. Operational eligibility asks a different question:
 * "is this session's actual occurrence happening under the old system or
 * the new one?" A reschedule moves that occurrence, so a session originally
 * booked pre-cutover but rescheduled to a post-cutover date must become
 * eligible for exceptions (e.g. a tutor who never records its outcome) —
 * using originalStartAt here would leave it permanently exempt even though
 * it's now live under Release 1B. Pass callers `startAt`, never
 * originalStartAt, for this specific check.
 */
export function isEligibleForOperationalExceptions(sessionDate: Date, cutoverAt: Date): boolean {
  return sessionDate.getTime() >= cutoverAt.getTime();
}
