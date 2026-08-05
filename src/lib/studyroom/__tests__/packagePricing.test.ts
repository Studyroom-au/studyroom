import { describe, it, expect } from "vitest";
import { standardPriceForPlanType, extractModePriceCents, type PackagePricingDoc } from "../packagePricing";

const pricing: PackagePricingDoc = {
  package5InHomePriceCents: 42500,
  package5OnlinePriceCents: 37500,
  package10InHomePriceCents: 80000,
  package10OnlinePriceCents: 72500,
};

describe("standardPriceForPlanType — mode-specific (Release 1B.1)", () => {
  it("returns the 5-session in-home price", () => {
    expect(standardPriceForPlanType(pricing, "package_5", "in_home")).toBe(42500);
  });

  it("returns the 5-session online price", () => {
    expect(standardPriceForPlanType(pricing, "package_5", "online")).toBe(37500);
  });

  it("returns the 10-session in-home price", () => {
    expect(standardPriceForPlanType(pricing, "package_10", "in_home")).toBe(80000);
  });

  it("returns the 10-session online price", () => {
    expect(standardPriceForPlanType(pricing, "package_10", "online")).toBe(72500);
  });
});

describe("extractModePriceCents — missing/invalid price blocks rather than guesses", () => {
  it("throws a clear error when the specific (type, mode) price is missing", () => {
    expect(() => extractModePriceCents({}, "package_5", "in_home")).toThrow(/not configured/i);
  });

  it("throws when the price is zero", () => {
    expect(() => extractModePriceCents({ package5InHomePriceCents: 0 }, "package_5", "in_home")).toThrow();
  });

  it("throws when the price is negative", () => {
    expect(() => extractModePriceCents({ package10OnlinePriceCents: -100 }, "package_10", "online")).toThrow();
  });

  it("never falls back to the legacy generic fields, even if present", () => {
    // Legacy fields present, but the mode-specific field is missing — must
    // still throw rather than silently using the legacy generic price for
    // an arbitrary mode.
    expect(() =>
      extractModePriceCents({ package5PriceCents: 40000, package10PriceCents: 75000 }, "package_5", "online")
    ).toThrow(/not configured/i);
  });

  it("succeeds when the specific field is present and valid", () => {
    expect(extractModePriceCents({ package10InHomePriceCents: 80000 }, "package_10", "in_home")).toBe(80000);
  });
});
