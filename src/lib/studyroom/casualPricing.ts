import type { Firestore } from "firebase-admin/firestore";
import { CASUAL_PRICING_TIERS, type CasualPricingTier } from "./billing";

// Firestore-backed casual pricing (final pre-release operational addition).
// Deliberately mirrors CASUAL_PRICING_TIERS's shape — an ordered, additive-
// only list of dated tiers — rather than a single mutable "current price"
// value, so the existing pricing-lock invariant (session.originalStartAt ->
// tier, decided once, never recomputed) continues to hold exactly as before.
//
// Read pattern: this is read ONCE by the caller of applySessionAction,
// OUTSIDE that function's Firestore transaction (see serverBilling.ts /
// api/sessions/status/route.ts) — applySessionAction itself never reads
// Firestore for pricing, so its transaction's read/write ordering is
// completely unchanged by this addition.

export const CASUAL_PRICING_COLLECTION = "settings";
export const CASUAL_PRICING_DOC_ID = "casualPricingTiers";

export type CasualPricingSettingsDoc = {
  tiers: CasualPricingTier[];
  updatedBy?: string | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;
};

function isValidTier(t: unknown): t is CasualPricingTier {
  if (typeof t !== "object" || t === null) return false;
  const r = t as Record<string, unknown>;
  if (typeof r.effectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom)) return false;
  const rates = r.rates as Record<string, unknown> | undefined;
  if (typeof rates !== "object" || rates === null) return false;
  return (
    Number.isFinite(rates.in_home) &&
    (rates.in_home as number) > 0 &&
    Number.isFinite(rates.online) &&
    (rates.online as number) > 0
  );
}

/**
 * Reads the Firestore-backed casual pricing tier list, falling back to the
 * hardcoded CASUAL_PRICING_TIERS in billing.ts whenever settings/
 * casualPricingTiers is missing, empty, or malformed — a casual invoice must
 * never silently price at $0. Never throws.
 */
export async function getCasualPricingTiers(db: Firestore): Promise<readonly CasualPricingTier[]> {
  try {
    const snap = await db.collection(CASUAL_PRICING_COLLECTION).doc(CASUAL_PRICING_DOC_ID).get();
    if (!snap.exists) return CASUAL_PRICING_TIERS;

    const data = snap.data() ?? {};
    const rawTiers = Array.isArray(data.tiers) ? data.tiers : [];
    const valid = rawTiers.filter(isValidTier) as CasualPricingTier[];
    if (valid.length === 0) return CASUAL_PRICING_TIERS;

    // Defensive: always sorted ascending by effectiveFrom, regardless of
    // storage order, since getSessionRateCents assumes an ordered list.
    return [...valid].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  } catch (e) {
    console.error("[getCasualPricingTiers] Firestore read failed, falling back to hardcoded tiers:", e);
    return CASUAL_PRICING_TIERS;
  }
}
