import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { resolveBookedAt } from "../serverBilling";
import { getSessionRateCents, PRICING_EFFECTIVE_DATE } from "../billing";

// This file tests the exact integration point inside applySessionAction that
// decides what date pricing is computed from — the one line that makes
// "rescheduling never changes price" true in the real billing engine, not
// just in the pure getSessionRateCents function tested elsewhere.

function brisbaneMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+10:00`);
}

const CUTOVER = brisbaneMidnight(PRICING_EFFECTIVE_DATE);

describe("resolveBookedAt — the pricing-lock decision point in applySessionAction", () => {
  it("uses originalStartAt when present, ignoring a different current startAt entirely", () => {
    const originalStartAt = Timestamp.fromDate(new Date(CUTOVER.getTime() - 7 * 86400000));
    const currentStartAt = new Date(CUTOVER.getTime() + 7 * 86400000); // simulates a reschedule

    const bookedAt = resolveBookedAt({ originalStartAt }, currentStartAt);

    expect(bookedAt.getTime()).toBe(originalStartAt.toDate().getTime());
    expect(bookedAt.getTime()).not.toBe(currentStartAt.getTime());
  });

  it("end-to-end: a session rescheduled from before to after the cutover still prices at the original (old) rate", () => {
    const originalStartAt = Timestamp.fromDate(new Date(CUTOVER.getTime() - 7 * 86400000));
    const rescheduledStartAt = new Date(CUTOVER.getTime() + 7 * 86400000);

    const bookedAt = resolveBookedAt({ originalStartAt }, rescheduledStartAt);
    expect(getSessionRateCents("in_home", bookedAt)).toBe(7500);
  });

  it("end-to-end: a session rescheduled from after to before the cutover still prices at the original (new) rate", () => {
    const originalStartAt = Timestamp.fromDate(new Date(CUTOVER.getTime() + 7 * 86400000));
    const rescheduledStartAt = new Date(CUTOVER.getTime() - 7 * 86400000);

    const bookedAt = resolveBookedAt({ originalStartAt }, rescheduledStartAt);
    expect(getSessionRateCents("in_home", bookedAt)).toBe(9000);
  });

  it("falls back to the current startAt only when originalStartAt is entirely absent (a pre-existing session predating this field)", () => {
    const currentStartAt = new Date(CUTOVER.getTime() + 1);
    const bookedAt = resolveBookedAt({ originalStartAt: undefined }, currentStartAt);
    expect(bookedAt.getTime()).toBe(currentStartAt.getTime());
  });

  it("falls back to the current startAt when originalStartAt is null", () => {
    const currentStartAt = new Date(CUTOVER.getTime() + 1);
    const bookedAt = resolveBookedAt({ originalStartAt: null }, currentStartAt);
    expect(bookedAt.getTime()).toBe(currentStartAt.getTime());
  });

  it("is a pure function of its two arguments — calling it repeatedly with the same inputs never varies, proving no hidden clock/'now' dependency", () => {
    const originalStartAt = Timestamp.fromDate(new Date(CUTOVER.getTime() - 3 * 86400000));
    const currentStartAt = new Date(CUTOVER.getTime());

    const first = resolveBookedAt({ originalStartAt }, currentStartAt);
    const second = resolveBookedAt({ originalStartAt }, currentStartAt);
    expect(first.getTime()).toBe(second.getTime());
  });
});
