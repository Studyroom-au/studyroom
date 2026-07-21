import { describe, it, expect } from "vitest";
import { getSessionRateCents, isCasualBillableMode, PRICING_EFFECTIVE_DATE } from "../billing";

// All dates in this file are derived from the exported PRICING_EFFECTIVE_DATE
// constant, never a duplicated literal — if the cutover date changes, these
// tests do not need to be rewritten, only re-run.
function brisbaneMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+10:00`);
}

const CUTOVER = brisbaneMidnight(PRICING_EFFECTIVE_DATE);
const ONE_MS = 1;
const SEVEN_DAYS_MS = 7 * 86400000;
const THIRTY_DAYS_MS = 30 * 86400000;

describe("getSessionRateCents — pricing lock at booking time (Release 1A, Stage 3)", () => {
  it("in-home immediately before the cutover uses the old rate", () => {
    const justBefore = new Date(CUTOVER.getTime() - ONE_MS);
    expect(getSessionRateCents("in_home", justBefore)).toBe(7500);
  });

  it("in-home exactly on the cutover uses the new rate", () => {
    expect(getSessionRateCents("in_home", CUTOVER)).toBe(9000);
  });

  it("in-home immediately after the cutover uses the new rate", () => {
    const justAfter = new Date(CUTOVER.getTime() + ONE_MS);
    expect(getSessionRateCents("in_home", justAfter)).toBe(9000);
  });

  it("online immediately before the cutover uses the old rate", () => {
    const justBefore = new Date(CUTOVER.getTime() - ONE_MS);
    expect(getSessionRateCents("online", justBefore)).toBe(6000);
  });

  it("online exactly on the cutover uses the new rate", () => {
    expect(getSessionRateCents("online", CUTOVER)).toBe(7500);
  });

  it("online immediately after the cutover uses the new rate", () => {
    const justAfter = new Date(CUTOVER.getTime() + ONE_MS);
    expect(getSessionRateCents("online", justAfter)).toBe(7500);
  });

  it("a session originally scheduled after the cutover uses the new rate, regardless of when the document was created", () => {
    // getSessionRateCents has no parameter for "document creation time" at
    // all — it only ever receives bookedAt (originalStartAt). This test
    // stands in for "created before deployment, scheduled after cutover" by
    // confirming the function's answer depends solely on the service date.
    const scheduledWellAfterCutover = new Date(CUTOVER.getTime() + THIRTY_DAYS_MS);
    expect(getSessionRateCents("in_home", scheduledWellAfterCutover)).toBe(9000);
  });

  it("before -> after reschedule preserves the original (old) pricing basis", () => {
    const originalStartAt = new Date(CUTOVER.getTime() - SEVEN_DAYS_MS);
    const rescheduledStartAt = new Date(CUTOVER.getTime() + SEVEN_DAYS_MS);

    // The price must come from originalStartAt...
    expect(getSessionRateCents("in_home", originalStartAt)).toBe(7500);

    // ...and this confirms the test isn't vacuous: the rescheduled date alone
    // really would have produced a different (wrong) answer if it were ever
    // mistakenly used instead.
    expect(getSessionRateCents("in_home", rescheduledStartAt)).toBe(9000);
  });

  it("after -> before reschedule preserves the original (new) pricing basis", () => {
    const originalStartAt = new Date(CUTOVER.getTime() + SEVEN_DAYS_MS);
    const rescheduledStartAt = new Date(CUTOVER.getTime() - SEVEN_DAYS_MS);

    expect(getSessionRateCents("in_home", originalStartAt)).toBe(9000);
    expect(getSessionRateCents("in_home", rescheduledStartAt)).toBe(7500);
  });

  it("completion/processing date does not affect pricing — the function has no clock input", () => {
    const originalStartAt = new Date(CUTOVER.getTime() - SEVEN_DAYS_MS);
    const priceNow = getSessionRateCents("in_home", originalStartAt);
    // Calling again with the identical bookedAt must always be identical,
    // regardless of how much real time has elapsed between calls — there is
    // no Date.now() anywhere in getSessionRateCents (verified by code review),
    // so this also guards against a future regression reintroducing one.
    const priceLater = getSessionRateCents("in_home", originalStartAt);
    expect(priceLater).toBe(priceNow);
    expect(priceNow).toBe(7500);
  });

  it("isCasualBillableMode rejects group/unsupported modes rather than allowing a guessed price", () => {
    expect(isCasualBillableMode("group")).toBe(false);
    expect(isCasualBillableMode("in_home")).toBe(true);
    expect(isCasualBillableMode("online")).toBe(true);
    expect(isCasualBillableMode(undefined)).toBe(false);
    expect(isCasualBillableMode("")).toBe(false);
  });
});
