import { describe, it, expect } from "vitest";
import { getSessionRateCents, CASUAL_PRICING_TIERS, type CasualPricingTier } from "../billing";
import { getCasualPricingTiers } from "../casualPricing";
import type { Firestore } from "firebase-admin/firestore";

// Final pre-release addition: Firestore-backed casual pricing tiers
// (settings/casualPricingTiers). getSessionRateCents itself is unchanged in
// behaviour for every existing caller (tiers defaults to the hardcoded
// CASUAL_PRICING_TIERS) — these tests specifically prove the NEW explicit-
// tiers path behaves identically to the pricing-lock invariant, plus that a
// missing/malformed Settings document safely falls back rather than ever
// producing a $0 casual invoice.

function brisbaneMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+10:00`);
}

const CUSTOM_TIERS: readonly CasualPricingTier[] = [
  { effectiveFrom: "2000-01-01", rates: { in_home: 7500, online: 6000 } },
  { effectiveFrom: "2026-10-06", rates: { in_home: 9000, online: 7500 } },
  { effectiveFrom: "2027-06-01", rates: { in_home: 9500, online: 8000 } },
];

function fakeDb(docData: Record<string, unknown> | null): Firestore {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: docData !== null,
          data: () => docData ?? {},
        }),
      }),
    }),
  } as unknown as Firestore;
}

describe("getSessionRateCents — explicit tiers parameter (Settings-backed casual pricing)", () => {
  it("a session originally booked before a rate-change date gets the old rate", () => {
    const before = brisbaneMidnight("2027-05-31");
    expect(getSessionRateCents("in_home", before, CUSTOM_TIERS)).toBe(9000);
  });

  it("a session originally booked after a rate-change date gets the new rate", () => {
    const after = brisbaneMidnight("2027-06-15");
    expect(getSessionRateCents("in_home", after, CUSTOM_TIERS)).toBe(9500);
  });

  it("rescheduling across the change date does not change the rate — only originalStartAt (bookedAt) matters", () => {
    const originalStartAt = brisbaneMidnight("2027-05-20"); // before the new tier
    // getSessionRateCents never receives a "rescheduled to" date — only
    // bookedAt (which resolveBookedAt always resolves to originalStartAt).
    // Calling it again with the same bookedAt after a hypothetical reschedule
    // to any other date must still return the pre-change rate.
    expect(getSessionRateCents("in_home", originalStartAt, CUSTOM_TIERS)).toBe(9000);
  });

  it("adding another future pricing tier does not alter a historical session's rate", () => {
    const historical = brisbaneMidnight("2026-11-01");
    const rateBeforeNewTierExisted = getSessionRateCents("in_home", historical, [
      CUSTOM_TIERS[0],
      CUSTOM_TIERS[1],
    ]);
    const rateAfterNewTierAdded = getSessionRateCents("in_home", historical, CUSTOM_TIERS);
    expect(rateAfterNewTierAdded).toBe(rateBeforeNewTierExisted);
    expect(rateAfterNewTierAdded).toBe(9000);
  });

  it("online and in-home rates resolve independently", () => {
    const afterNewestTier = brisbaneMidnight("2027-07-01");
    expect(getSessionRateCents("in_home", afterNewestTier, CUSTOM_TIERS)).toBe(9500);
    expect(getSessionRateCents("online", afterNewestTier, CUSTOM_TIERS)).toBe(8000);
  });

  it("omitting the tiers parameter falls back to the hardcoded CASUAL_PRICING_TIERS (unchanged existing behaviour)", () => {
    const bookedAt = brisbaneMidnight("2026-10-06");
    expect(getSessionRateCents("in_home", bookedAt)).toBe(
      getSessionRateCents("in_home", bookedAt, CASUAL_PRICING_TIERS)
    );
  });
});

describe("getCasualPricingTiers — Settings read with safe fallback (never $0)", () => {
  it("falls back to the hardcoded tiers when settings/casualPricingTiers does not exist", async () => {
    const db = fakeDb(null);
    const tiers = await getCasualPricingTiers(db);
    expect(tiers).toEqual(CASUAL_PRICING_TIERS);
  });

  it("falls back to the hardcoded tiers when the document exists but has no valid tiers array", async () => {
    const db = fakeDb({ tiers: [] });
    const tiers = await getCasualPricingTiers(db);
    expect(tiers).toEqual(CASUAL_PRICING_TIERS);
  });

  it("falls back to the hardcoded tiers when tiers contains only malformed entries", async () => {
    const db = fakeDb({ tiers: [{ effectiveFrom: "not-a-date", rates: { in_home: 1 } }] });
    const tiers = await getCasualPricingTiers(db);
    expect(tiers).toEqual(CASUAL_PRICING_TIERS);
  });

  it("returns the Settings-configured tiers, sorted, when valid", async () => {
    const db = fakeDb({
      tiers: [
        { effectiveFrom: "2027-06-01", rates: { in_home: 9500, online: 8000 } },
        { effectiveFrom: "2000-01-01", rates: { in_home: 7500, online: 6000 } },
      ],
    });
    const tiers = await getCasualPricingTiers(db);
    expect(tiers.map((t) => t.effectiveFrom)).toEqual(["2000-01-01", "2027-06-01"]);
  });

  it("never throws — a Firestore read failure falls back rather than crashing the caller", async () => {
    const throwingDb = {
      collection: () => ({
        doc: () => ({
          get: async () => {
            throw new Error("simulated Firestore outage");
          },
        }),
      }),
    } as unknown as Firestore;
    const tiers = await getCasualPricingTiers(throwingDb);
    expect(tiers).toEqual(CASUAL_PRICING_TIERS);
  });
});
