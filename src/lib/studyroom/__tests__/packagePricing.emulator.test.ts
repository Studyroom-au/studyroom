import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getPackagePricing } from "../packagePricing";

async function clearSettings() {
  const db = getAdminDb();
  const snap = await db.collection("settings").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(clearSettings);
afterAll(clearSettings);

describe("getPackagePricing (emulator)", () => {
  it("throws if settings/packagePricing does not exist yet", async () => {
    const db = getAdminDb();
    await expect(getPackagePricing(db)).rejects.toThrow(/not configured/i);
  });

  it("throws if package5PriceCents is missing/invalid", async () => {
    const db = getAdminDb();
    await db.collection("settings").doc("packagePricing").set({ package10PriceCents: 80000 });
    await expect(getPackagePricing(db)).rejects.toThrow(/package5PriceCents/);
  });

  it("throws if package10PriceCents is zero or negative", async () => {
    const db = getAdminDb();
    await db.collection("settings").doc("packagePricing").set({ package5PriceCents: 42500, package10PriceCents: 0 });
    await expect(getPackagePricing(db)).rejects.toThrow(/package10PriceCents/);
  });

  it("returns the configured prices when valid", async () => {
    const db = getAdminDb();
    await db.collection("settings").doc("packagePricing").set({
      package5PriceCents: 42500,
      package10PriceCents: 80000,
      updatedBy: "lily.studyroom@gmail.com",
    });
    const pricing = await getPackagePricing(db);
    expect(pricing.package5PriceCents).toBe(42500);
    expect(pricing.package10PriceCents).toBe(80000);
  });
});
