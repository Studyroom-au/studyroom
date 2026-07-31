import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { createPlan, type CreatablePlanType } from "@/lib/studyroom/planCommerce";
import type { DiscountType } from "@/lib/studyroom/billing";

// Release 1B, Stage 5: the ONE place a new (first-purchase) package or casual
// plan is created. Replaces the old client-side writeBatch in
// StudentOnboardingPanel.tsx / add-existing/page.tsx. Casual plans get no
// entitlement and no invoice (unchanged); package_5/package_10 always get
// both, in the same transaction (see planCommerce.ts), so an entitlement can
// never exist without its linked financial record. Admin-only.

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
      clientId?: string;
      studentId?: string;
      tutorId?: string | null;
      tutorEmail?: string | null;
      mode?: string;
      planType?: string;
      discountType?: DiscountType | null;
      discountValue?: number | null;
      discountReason?: string | null;
    };

    const result = await createPlan(db, {
      clientId: String(body.clientId ?? "").trim(),
      studentId: String(body.studentId ?? "").trim(),
      tutorId: body.tutorId ?? null,
      tutorEmail: body.tutorEmail ?? null,
      mode: body.mode ?? null,
      planType: (body.planType ?? "") as CreatablePlanType,
      discountType: body.discountType ?? null,
      discountValue: body.discountValue ?? null,
      discountReason: body.discountReason ?? null,
      actor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
