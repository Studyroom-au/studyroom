import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getPackagePricing, extractModePriceCents } from "../packagePricing";

async function clearSettings() {
  const db = getAdminDb();
  const snap = await db.collection("settings").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(clearSettings);
afterAll(clearSettings);

describe("getPackagePricing (emulator) — Release 1B.1 mode-specific pricing", () => {
  it("throws if settings/packagePricing does not exist yet", async () => {
    const db = getAdminDb();
    await expect(getPackagePricing(db)).rejects.toThrow(/not configured/i);
  });

  it("returns all four mode-specific prices when configured", async () => {
    const db = getAdminDb();
    await db.collection("settings").doc("packagePricing").set({
      package5InHomePriceCents: 42500,
      package5OnlinePriceCents: 37500,
      package10InHomePriceCents: 80000,
      package10OnlinePriceCents: 72500,
      updatedBy: "lily.studyroom@gmail.com",
    });
    const pricing = await getPackagePricing(db);
    expect(pricing.package5InHomePriceCents).toBe(42500);
    expect(pricing.package5OnlinePriceCents).toBe(37500);
    expect(pricing.package10InHomePriceCents).toBe(80000);
    expect(pricing.package10OnlinePriceCents).toBe(72500);
  });

  it("preserves legacy generic fields on the document without using them for pricing", async () => {
    const db = getAdminDb();
    await db.collection("settings").doc("packagePricing").set({
      package5PriceCents: 40000,
      package10PriceCents: 75000,
      package5InHomePriceCents: 42500,
      package5OnlinePriceCents: 37500,
      package10InHomePriceCents: 80000,
      package10OnlinePriceCents: 72500,
    });
    const pricing = await getPackagePricing(db);
    // Legacy fields are still readable (for informational display)...
    expect(pricing.package5PriceCents).toBe(40000);
    // ...but extractModePriceCents only ever reads the mode-specific fields.
    expect(extractModePriceCents(pricing as unknown as Record<string, unknown>, "package_5", "in_home")).toBe(42500);
  });

  it("extractModePriceCents throws for a configured document missing one specific mode price", async () => {
    const db = getAdminDb();
    await db.collection("settings").doc("packagePricing").set({
      package5InHomePriceCents: 42500,
      // package5OnlinePriceCents deliberately missing
      package10InHomePriceCents: 80000,
      package10OnlinePriceCents: 72500,
    });
    const pricing = await getPackagePricing(db);
    expect(() => extractModePriceCents(pricing as unknown as Record<string, unknown>, "package_5", "online")).toThrow(/not configured/i);
  });
});
