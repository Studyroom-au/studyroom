import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { PACKAGE_PRICING_COLLECTION, PACKAGE_PRICING_DOC_ID } from "@/lib/studyroom/packagePricing";

// Release 1B: the ONLY write path for settings/packagePricing — firestore.rules
// blocks every client-side write to this document (see `match /settings/{docId}`).
// Admin-only. Does not touch any existing plan's already-snapshotted pricing —
// see src/lib/studyroom/packagePricing.ts for why that's safe.

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
    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      package5InHomePriceCents?: number;
      package5OnlinePriceCents?: number;
      package10InHomePriceCents?: number;
      package10OnlinePriceCents?: number;
    };

    const fields: Array<[string, number | undefined]> = [
      ["package5InHomePriceCents", body.package5InHomePriceCents],
      ["package5OnlinePriceCents", body.package5OnlinePriceCents],
      ["package10InHomePriceCents", body.package10InHomePriceCents],
      ["package10OnlinePriceCents", body.package10OnlinePriceCents],
    ];

    const validated: Record<string, number> = {};
    for (const [name, raw] of fields) {
      const value = Number(raw);
      if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
        return NextResponse.json({ error: `${name} must be a positive whole number of cents.` }, { status: 400 });
      }
      validated[name] = value;
    }

    await db
      .collection(PACKAGE_PRICING_COLLECTION)
      .doc(PACKAGE_PRICING_DOC_ID)
      .set(
        {
          ...validated,
          updatedBy: decoded.email ?? decoded.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, ...validated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update package pricing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
