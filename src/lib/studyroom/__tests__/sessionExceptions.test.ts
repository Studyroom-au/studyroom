import { describe, it, expect } from "vitest";
import { isOverdueScheduled, hasBillingOutcomeFailure, isEligibleForOperationalExceptions } from "../sessionExceptions";

describe("isOverdueScheduled", () => {
  const now = new Date("2026-07-30T12:00:00+10:00");

  it("is false for a scheduled session still in the future", () => {
    const startAt = new Date("2026-07-30T14:00:00+10:00");
    expect(isOverdueScheduled("scheduled", startAt, 60, now)).toBe(false);
  });

  it("is false for a scheduled session that ended within the grace window", () => {
    const startAt = new Date("2026-07-30T11:00:00+10:00"); // ends 12:00, now is 12:00
    expect(isOverdueScheduled("scheduled", startAt, 60, now)).toBe(false);
  });

  it("is true once a scheduled session's end time + grace has passed", () => {
    const startAt = new Date("2026-07-30T10:00:00+10:00"); // ends 11:00, +30min grace = 11:30
    expect(isOverdueScheduled("scheduled", startAt, 60, now)).toBe(true);
  });

  it("is never true for a completed session, even long past", () => {
    const startAt = new Date("2026-07-29T10:00:00+10:00");
    expect(isOverdueScheduled("completed", startAt, 60, now)).toBe(false);
  });

  it("is never true for a cancelled session", () => {
    const startAt = new Date("2026-07-29T10:00:00+10:00");
    expect(isOverdueScheduled("cancelled_by_parent", startAt, 60, now)).toBe(false);
  });
});

describe("hasBillingOutcomeFailure", () => {
  it("is false for a non-completed session regardless of billingOutcome", () => {
    expect(hasBillingOutcomeFailure("scheduled", null, null)).toBe(false);
  });

  it("is true when a completed session never got a billingOutcome", () => {
    expect(hasBillingOutcomeFailure("completed", null, null)).toBe(true);
    expect(hasBillingOutcomeFailure("completed", undefined, null)).toBe(true);
  });

  it("is false when a completed session has a normal billingOutcome and no invoice issue", () => {
    expect(hasBillingOutcomeFailure("completed", "consume_entitlement", null)).toBe(false);
    expect(hasBillingOutcomeFailure("completed", "no_charge", null)).toBe(false);
  });

  it("is true when the linked invoice failed to push to Xero", () => {
    expect(hasBillingOutcomeFailure("completed", "invoice", "xero_failed")).toBe(true);
  });

  it("is false when the linked invoice is fine", () => {
    expect(hasBillingOutcomeFailure("completed", "invoice", "pending_xero")).toBe(false);
    expect(hasBillingOutcomeFailure("completed", "invoice", "draft_created")).toBe(false);
  });
});

describe("isEligibleForOperationalExceptions — Operations Cutover gate", () => {
  const cutoverAt = new Date("2026-07-31T00:00:00+10:00");

  it("a session before the cutover is not eligible for a new exception", () => {
    expect(isEligibleForOperationalExceptions(new Date("2026-07-30T06:00:00+10:00"), cutoverAt)).toBe(false);
  });

  it("a session exactly at the cutover instant is eligible", () => {
    expect(isEligibleForOperationalExceptions(cutoverAt, cutoverAt)).toBe(true);
  });

  it("a session after the cutover is eligible", () => {
    expect(isEligibleForOperationalExceptions(new Date("2026-08-01T09:00:00+10:00"), cutoverAt)).toBe(true);
  });

  it("far-future post-cutover sessions remain eligible", () => {
    expect(isEligibleForOperationalExceptions(new Date("2027-01-01T00:00:00+10:00"), cutoverAt)).toBe(true);
  });

  it("regression: a session rescheduled from before the cutover to after it must use startAt, not originalStartAt", () => {
    // Originally booked 30 July (pre-cutover), legitimately rescheduled to
    // 5 August (post-cutover). Its actual occurrence now happens under
    // Release 1B, so a tutor who never records its outcome must be flagged —
    // callers must pass the session's current startAt to this gate, never
    // originalStartAt (the pricing-lock field, which never changes on
    // reschedule and would wrongly exempt this session forever).
    const originalStartAt = new Date("2026-07-30T09:00:00+10:00");
    const rescheduledStartAt = new Date("2026-08-05T09:00:00+10:00");

    expect(isEligibleForOperationalExceptions(rescheduledStartAt, cutoverAt)).toBe(true);
    expect(isEligibleForOperationalExceptions(originalStartAt, cutoverAt)).toBe(false);
  });
});
