import type { Firestore } from "firebase-admin/firestore";

// Release 1B: the single canonical source of truth for what a 5- or
// 10-session package currently costs. Deliberately NOT date-tiered (unlike
// casual pricing) — a single current value, admin-editable only via
// POST /api/settings/package-pricing (never a direct client Firestore write;
// see firestore.rules `settings/{docId}`). Read once at the moment a package
// is created or renewed, then snapshotted onto that specific plan
// (standardPriceCents) — this doc is never read again for an existing plan,
// so editing it here never rewrites history.

export const PACKAGE_PRICING_COLLECTION = "settings";
export const PACKAGE_PRICING_DOC_ID = "packagePricing";

export type PackagePricingDoc = {
  package5PriceCents: number;
  package10PriceCents: number;
  updatedBy?: string | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;
};

/**
 * Reads the current canonical package pricing. Throws if the document is
 * missing or malformed — package creation/renewal must never guess a price.
 */
export async function getPackagePricing(db: Firestore): Promise<PackagePricingDoc> {
  const snap = await db.collection(PACKAGE_PRICING_COLLECTION).doc(PACKAGE_PRICING_DOC_ID).get();
  if (!snap.exists) {
    throw new Error(
      "Package pricing is not configured yet (settings/packagePricing is missing). Set it via the admin settings page before creating or renewing a package."
    );
  }
  const data = snap.data() ?? {};
  const package5PriceCents = Number(data.package5PriceCents);
  const package10PriceCents = Number(data.package10PriceCents);
  if (!Number.isFinite(package5PriceCents) || package5PriceCents <= 0) {
    throw new Error("Package pricing is misconfigured: package5PriceCents must be a positive number.");
  }
  if (!Number.isFinite(package10PriceCents) || package10PriceCents <= 0) {
    throw new Error("Package pricing is misconfigured: package10PriceCents must be a positive number.");
  }
  return { package5PriceCents, package10PriceCents, updatedBy: data.updatedBy ?? null, updatedAt: data.updatedAt ?? null };
}

/** Returns the canonical standard price for a given current-sellable package type. */
export function standardPriceForPlanType(
  pricing: PackagePricingDoc,
  planType: "package_5" | "package_10"
): number {
  return planType === "package_10" ? pricing.package10PriceCents : pricing.package5PriceCents;
}
