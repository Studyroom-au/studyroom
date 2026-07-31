import { describe, it, expect } from "vitest";
import {
  getEntitlementSeed,
  isPrepaidPlan,
  normalizePlanType,
  formatPlanLabel,
} from "../billing";

// Release 1B: current sellable packages are casual / package_5 / package_10
// (package_10 = exactly 10 sessions, no bonus). package_12 (10 base + 2 bonus)
// is retired from new sales but must keep working exactly as before for the
// small number of pre-existing legacy plans a production audit confirmed
// still exist and are still active — these tests lock in both halves of that.

describe("getEntitlementSeed — package_10 (current) vs package_12 (legacy, read-only)", () => {
  it("package_10 seeds exactly 10 sessions, no bonus", () => {
    expect(getEntitlementSeed("package_10")).toEqual({ remainingSessions: 10, bonusRemaining: 0 });
  });

  it("package_5 seeds exactly 5 sessions, no bonus", () => {
    expect(getEntitlementSeed("package_5")).toEqual({ remainingSessions: 5, bonusRemaining: 0 });
  });

  it("package_12 (legacy) still seeds 10 + 2 bonus, unchanged, so any existing legacy plan that ever needs a missing entitlement backfilled is not silently shorted", () => {
    expect(getEntitlementSeed("package_12")).toEqual({ remainingSessions: 10, bonusRemaining: 2 });
  });

  it("casual seeds zero — no entitlement", () => {
    expect(getEntitlementSeed("casual")).toEqual({ remainingSessions: 0, bonusRemaining: 0 });
  });
});

describe("isPrepaidPlan — package_12 stays prepaid so legacy plans keep consuming entitlements, not casual invoicing", () => {
  it("package_5, package_10, and package_12 are all prepaid", () => {
    expect(isPrepaidPlan("package_5")).toBe(true);
    expect(isPrepaidPlan("package_10")).toBe(true);
    expect(isPrepaidPlan("package_12")).toBe(true);
  });

  it("casual is not prepaid", () => {
    expect(isPrepaidPlan("casual")).toBe(false);
  });
});

describe("normalizePlanType — package_10 is selectable, package_12 is recognized but never produced by any current UI", () => {
  it("normalizes package_10 (any case)", () => {
    expect(normalizePlanType("package_10")).toBe("package_10");
    expect(normalizePlanType("PACKAGE_10")).toBe("package_10");
  });

  it("still recognizes package_12 for legacy reads", () => {
    expect(normalizePlanType("package_12")).toBe("package_12");
    expect(normalizePlanType("PACKAGE_12")).toBe("package_12");
  });

  it("falls back to casual for anything else, including package_10's old un-normalized spelling gaps", () => {
    expect(normalizePlanType("something_else")).toBe("casual");
    expect(normalizePlanType(undefined)).toBe("casual");
  });
});

describe("formatPlanLabel", () => {
  it("labels package_10 as current, package_12 as explicitly legacy", () => {
    expect(formatPlanLabel("package_10")).toBe("10-session package");
    expect(formatPlanLabel("package_12")).toBe("12-session package (legacy)");
    expect(formatPlanLabel("package_5")).toBe("5-session package");
    expect(formatPlanLabel("casual")).toBe("Casual");
  });
});
