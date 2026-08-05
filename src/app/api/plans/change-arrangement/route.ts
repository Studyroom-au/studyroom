import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { changeArrangement, type ArrangementTargetType } from "@/lib/studyroom/planCommerce";
import type { DiscountType } from "@/lib/studyroom/billing";

// Release 1B.1: the ONE place a student's arrangement moves off Casual (or
// off a legacy package_12) onto a current package, or onto Casual for the
// first time. Distinct from /api/plans/renew (package_5/10 -> package_5/10).
// Admin-only, server-side, single Firestore transaction — see
// planCommerce.ts's changeArrangement() for the full safety rules.

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
      studentId?: string;
      targetPlanType?: string;
      mode?: string;
      discountType?: DiscountType | null;
      discountValue?: number | null;
      discountReason?: string | null;
      commencementAt?: string | null;
      sessionsAlreadyCompleted?: number;
      carryOverSessions?: number;
      reason?: string;
    };

    const commencementAt = body.commencementAt ? new Date(body.commencementAt) : null;
    if (commencementAt && isNaN(commencementAt.getTime())) {
      return NextResponse.json({ error: "commencementAt must be a valid date." }, { status: 400 });
    }

    const result = await changeArrangement(db, {
      studentId: String(body.studentId ?? "").trim(),
      targetPlanType: (body.targetPlanType ?? "") as ArrangementTargetType,
      mode: body.mode ?? null,
      discountType: body.discountType ?? null,
      discountValue: body.discountValue ?? null,
      discountReason: body.discountReason ?? null,
      commencementAt,
      sessionsAlreadyCompleted: body.sessionsAlreadyCompleted,
      carryOverSessions: body.carryOverSessions,
      reason: String(body.reason ?? ""),
      actor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to change arrangement";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
