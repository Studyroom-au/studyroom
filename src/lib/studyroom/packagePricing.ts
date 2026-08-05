import type { Firestore } from "firebase-admin/firestore";

// Release 1B.1: the single canonical source of truth for what a 5- or
// 10-session package currently costs — mode-specific (in-home vs online are
// genuinely different prices; see the founder's explicit correction).
// Deliberately NOT date-tiered (unlike casual pricing) — a single current
// value per (package type, mode) pair, admin-editable only via
// POST /api/settings/package-pricing (never a direct client Firestore write;
// see firestore.rules `settings/{docId}`). Read once at the moment a package
// is created/renewed/transitioned, then snapshotted onto that specific plan
// (standardPriceCents) — this doc is never read again for an existing plan,
// so editing it here never rewrites history.

export const PACKAGE_PRICING_COLLECTION = "settings";
export const PACKAGE_PRICING_DOC_ID = "packagePricing";

export type PackagePlanTypeForPricing = "package_5" | "package_10";
export type PackageModeForPricing = "in_home" | "online";

export type PackagePricingDoc = {
  package5InHomePriceCents?: number;
  package5OnlinePriceCents?: number;
  package10InHomePriceCents?: number;
  package10OnlinePriceCents?: number;
  // Legacy generic (non-mode-specific) fields from before this change.
  // Never read by any pricing decision anymore — deliberately not mapped to
  // either mode, since guessing which mode a historical generic price meant
  // would risk silently applying the wrong price. Kept only so an existing
  // settings/packagePricing document isn't treated as corrupt; the admin
  // Settings page may display them as informational/legacy-only.
  package5PriceCents?: number | null;
  package10PriceCents?: number | null;
  updatedBy?: string | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;
};

function modePriceFieldName(planType: PackagePlanTypeForPricing, mode: PackageModeForPricing): keyof PackagePricingDoc {
  if (planType === "package_5") return mode === "online" ? "package5OnlinePriceCents" : "package5InHomePriceCents";
  return mode === "online" ? "package10OnlinePriceCents" : "package10InHomePriceCents";
}

function modeLabel(mode: PackageModeForPricing): string {
  return mode === "online" ? "online" : "in-home";
}

/**
 * Extracts and validates the mode-specific standard price from a raw
 * settings/packagePricing document's data. Pure (no Firestore dependency) so
 * it can be reused both by a plain read (getPackagePricing) and by a
 * transactional read inside a Firestore transaction (planCommerce.ts reads
 * the doc itself via tx.get, then calls this to extract/validate). Throws a
 * clear, admin-facing error rather than ever guessing or defaulting to $0.
 */
export function extractModePriceCents(
  data: Record<string, unknown>,
  planType: PackagePlanTypeForPricing,
  mode: PackageModeForPricing
): number {
  const fieldName = modePriceFieldName(planType, mode);
  const value = Number(data[fieldName]);
  if (!Number.isFinite(value) || value <= 0) {
    const packageLabel = planType === "package_10" ? "10-session" : "5-session";
    throw new Error(
      `Package pricing is not configured for the ${packageLabel} ${modeLabel(mode)} package. Set it on the Settings page before creating, renewing, or transitioning this package.`
    );
  }
  return value;
}

/**
 * Reads the current canonical package pricing document (plain, non-
 * transactional read — for display purposes, e.g. the admin Settings page).
 * Does not validate every field is present; use extractModePriceCents for
 * the specific (planType, mode) pair actually being priced.
 */
export async function getPackagePricing(db: Firestore): Promise<PackagePricingDoc> {
  const snap = await db.collection(PACKAGE_PRICING_COLLECTION).doc(PACKAGE_PRICING_DOC_ID).get();
  if (!snap.exists) {
    throw new Error(
      "Package pricing is not configured yet (settings/packagePricing is missing). Set it via the admin settings page before creating or renewing a package."
    );
  }
  const data = snap.data() ?? {};
  return {
    package5InHomePriceCents: data.package5InHomePriceCents ?? undefined,
    package5OnlinePriceCents: data.package5OnlinePriceCents ?? undefined,
    package10InHomePriceCents: data.package10InHomePriceCents ?? undefined,
    package10OnlinePriceCents: data.package10OnlinePriceCents ?? undefined,
    package5PriceCents: data.package5PriceCents ?? null,
    package10PriceCents: data.package10PriceCents ?? null,
    updatedBy: data.updatedBy ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/** Returns the canonical standard price for a given current-sellable package type + mode. */
export function standardPriceForPlanType(
  pricing: PackagePricingDoc,
  planType: PackagePlanTypeForPricing,
  mode: PackageModeForPricing
): number {
  return extractModePriceCents(pricing as unknown as Record<string, unknown>, planType, mode);
}
