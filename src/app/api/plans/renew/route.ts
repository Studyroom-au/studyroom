import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { renewPlan, type RenewablePlanType } from "@/lib/studyroom/planCommerce";
import type { DiscountType } from "@/lib/studyroom/billing";

// Release 1B, Stage 5: the complete renewal lifecycle (plan doc §8) — old
// package -> admin decision (type, carry-over, discount keep/change/remove)
// -> new plan+entitlement -> canonical activePlanId updated -> linked
// package-purchase invoice created through the same invoice collection/Xero
// pipeline every other invoice uses -> old plan preserved as history
// (status: "expired", never mutated further, never deleted). See
// planCommerce.ts for the actual transaction. Admin-only.
//
// Renewal is only for a plan that is ALREADY a current package (package_5 or
// package_10) — a casual family's first package purchase goes through
// /api/plans/create instead. A legacy package_12 plan can never be renewed
// through this route.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: Request) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const token = readBearerToken(req);
    if (!token) return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }
    const actor = decoded.email || decoded.uid;

    const body = (await req.json().catch(() => ({}))) as {
      oldPlanId?: string;
      newPlanType?: string;
      carryOverSessions?: number;
      mode?: string;
      discountType?: DiscountType | null;
      discountValue?: number | null;
      discountReason?: string | null;
    };

    const result = await renewPlan(db, {
      oldPlanId: String(body.oldPlanId ?? "").trim(),
      newPlanType: (body.newPlanType ?? "") as RenewablePlanType,
      carryOverSessions: body.carryOverSessions,
      mode: body.mode ?? null,
      discountType: body.discountType ?? null,
      discountValue: body.discountValue ?? null,
      discountReason: body.discountReason ?? null,
      actor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to renew plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
