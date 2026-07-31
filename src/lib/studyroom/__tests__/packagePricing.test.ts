import { describe, it, expect } from "vitest";
import { standardPriceForPlanType, type PackagePricingDoc } from "../packagePricing";

const pricing: PackagePricingDoc = { package5PriceCents: 42500, package10PriceCents: 80000 };

describe("standardPriceForPlanType", () => {
  it("returns the 5-session price for package_5", () => {
    expect(standardPriceForPlanType(pricing, "package_5")).toBe(42500);
  });

  it("returns the 10-session price for package_10", () => {
    expect(standardPriceForPlanType(pricing, "package_10")).toBe(80000);
  });
});
