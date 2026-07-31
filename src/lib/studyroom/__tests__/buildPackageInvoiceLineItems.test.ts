import { describe, it, expect } from "vitest";
import { buildPackageInvoiceLineItems } from "../billing";

describe("buildPackageInvoiceLineItems", () => {
  it("no discount: a single line item at the full standard price", () => {
    const items = buildPackageInvoiceLineItems({
      planType: "package_10",
      studentName: "Ada",
      standardPriceCents: 80000,
      discountAmountCents: 0,
    });
    expect(items).toEqual([{ description: "10-session package — Ada", quantity: 1, unitAmount: 800 }]);
  });

  it("with a discount: base line at full price, plus a separate negative discount line", () => {
    const items = buildPackageInvoiceLineItems({
      planType: "package_10",
      studentName: "Ada",
      standardPriceCents: 80000,
      discountAmountCents: 8000,
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ description: "10-session package — Ada", quantity: 1, unitAmount: 800 });
    expect(items[1]).toEqual({ description: "Discount", quantity: 1, unitAmount: -80 });
  });
});
