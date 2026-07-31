import { describe, it, expect } from "vitest";
import { computeDiscount } from "../billing";

describe("computeDiscount — Release 1B package discount snapshot", () => {
  it("no discount: finalPriceCents equals standardPriceCents", () => {
    const r = computeDiscount({ standardPriceCents: 80000 });
    expect(r).toEqual({ discountType: null, discountValue: null, discountAmountCents: 0, finalPriceCents: 80000 });
  });

  it("percent discount computes and floors correctly", () => {
    const r = computeDiscount({ standardPriceCents: 80000, discountType: "percent", discountValue: 10 });
    expect(r.discountAmountCents).toBe(8000);
    expect(r.finalPriceCents).toBe(72000);
  });

  it("fixed discount subtracts a flat cents amount", () => {
    const r = computeDiscount({ standardPriceCents: 80000, discountType: "fixed", discountValue: 5000 });
    expect(r.discountAmountCents).toBe(5000);
    expect(r.finalPriceCents).toBe(75000);
  });

  it("never goes below zero even if the discount exceeds the standard price", () => {
    const r = computeDiscount({ standardPriceCents: 8000, discountType: "fixed", discountValue: 50000 });
    expect(r.finalPriceCents).toBe(0);
  });

  it("100% discount results in a final price of exactly zero", () => {
    const r = computeDiscount({ standardPriceCents: 80000, discountType: "percent", discountValue: 100 });
    expect(r.finalPriceCents).toBe(0);
  });

  it("rejects a percentage outside 0-100", () => {
    expect(() => computeDiscount({ standardPriceCents: 80000, discountType: "percent", discountValue: 150 })).toThrow(/between 0 and 100/);
    expect(() => computeDiscount({ standardPriceCents: 80000, discountType: "percent", discountValue: -5 })).toThrow(/between 0 and 100/);
  });

  it("rejects a negative fixed discount", () => {
    expect(() => computeDiscount({ standardPriceCents: 80000, discountType: "fixed", discountValue: -100 })).toThrow(/cannot be negative/);
  });

  it("rejects a missing discountValue when discountType is set", () => {
    expect(() => computeDiscount({ standardPriceCents: 80000, discountType: "percent", discountValue: undefined })).toThrow(/must be a number/);
  });

  it("rejects a negative standardPriceCents", () => {
    expect(() => computeDiscount({ standardPriceCents: -1 })).toThrow(/non-negative/);
  });
});
