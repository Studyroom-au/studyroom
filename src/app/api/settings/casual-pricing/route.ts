import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { CASUAL_PRICING_COLLECTION, CASUAL_PRICING_DOC_ID, getCasualPricingTiers } from "@/lib/studyroom/casualPricing";

// The ONLY write path for settings/casualPricingTiers — firestore.rules
// blocks every client-side write to any doc under settings/ (see
// `match /settings/{docId}`). Admin-only.
//
// Critical invariant: this can only ever APPEND a new future tier, or edit a
// tier that hasn't become effective yet — it can never modify a tier whose
// effectiveFrom is today or earlier, since that tier may have already priced
// real sessions (session.originalStartAt -> tier is decided once, at billing
// time, and never recomputed — see serverBilling.ts). This route never
// touches applySessionAction or its transaction.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function todayBrisbaneDateString(): string {
  // Queensland has no DST — a fixed +10:00 offset is always correct.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
}

export async function POST(req: Request) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const token = readBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      effectiveFrom?: string;
      inHomeRateCents?: number;
      onlineRateCents?: number;
    };

    const effectiveFrom = String(body.effectiveFrom ?? "").trim();
    const inHomeRateCents = Number(body.inHomeRateCents);
    const onlineRateCents = Number(body.onlineRateCents);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      return NextResponse.json({ error: "effectiveFrom must be a YYYY-MM-DD date." }, { status: 400 });
    }
    if (!Number.isFinite(inHomeRateCents) || !Number.isInteger(inHomeRateCents) || inHomeRateCents <= 0) {
      return NextResponse.json({ error: "inHomeRateCents must be a positive whole number of cents." }, { status: 400 });
    }
    if (!Number.isFinite(onlineRateCents) || !Number.isInteger(onlineRateCents) || onlineRateCents <= 0) {
      return NextResponse.json({ error: "onlineRateCents must be a positive whole number of cents." }, { status: 400 });
    }

    const today = todayBrisbaneDateString();
    if (effectiveFrom <= today) {
      return NextResponse.json(
        { error: `effectiveFrom must be strictly after today (${today}) — this schedules a future change, it never edits an already-effective tier.` },
        { status: 400 }
      );
    }

    const currentTiers = await getCasualPricingTiers(db); // seeded/fallback-safe read
    const sorted = [...currentTiers].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const alreadyEffective = sorted.filter((t) => t.effectiveFrom <= today);
    const scheduled = sorted.filter((t) => t.effectiveFrom > today);

    const latestAlreadyEffective = alreadyEffective[alreadyEffective.length - 1];
    if (latestAlreadyEffective && effectiveFrom <= latestAlreadyEffective.effectiveFrom) {
      return NextResponse.json(
        { error: "Cannot schedule a change on or before the currently-effective pricing tier." },
        { status: 400 }
      );
    }

    // If a tier is already scheduled for this exact future date, this is an
    // edit of a not-yet-effective change (replace it); otherwise this is a
    // brand-new scheduled tier (append it). Either way, every tier that is
    // already effective is carried through completely untouched.
    const remainingScheduled = scheduled.filter((t) => t.effectiveFrom !== effectiveFrom);
    const newTier = { effectiveFrom, rates: { in_home: inHomeRateCents, online: onlineRateCents } };
    const nextTiers = [...alreadyEffective, ...remainingScheduled, newTier].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom)
    );

    await db
      .collection(CASUAL_PRICING_COLLECTION)
      .doc(CASUAL_PRICING_DOC_ID)
      .set(
        {
          tiers: nextTiers,
          updatedBy: decoded.email ?? decoded.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, tiers: nextTiers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update casual pricing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
