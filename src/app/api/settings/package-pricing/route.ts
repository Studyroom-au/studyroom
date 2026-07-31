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
      package5PriceCents?: number;
      package10PriceCents?: number;
    };

    const package5PriceCents = Number(body.package5PriceCents);
    const package10PriceCents = Number(body.package10PriceCents);

    if (!Number.isFinite(package5PriceCents) || !Number.isInteger(package5PriceCents) || package5PriceCents <= 0) {
      return NextResponse.json({ error: "package5PriceCents must be a positive whole number of cents." }, { status: 400 });
    }
    if (!Number.isFinite(package10PriceCents) || !Number.isInteger(package10PriceCents) || package10PriceCents <= 0) {
      return NextResponse.json({ error: "package10PriceCents must be a positive whole number of cents." }, { status: 400 });
    }

    await db
      .collection(PACKAGE_PRICING_COLLECTION)
      .doc(PACKAGE_PRICING_DOC_ID)
      .set(
        {
          package5PriceCents,
          package10PriceCents,
          updatedBy: decoded.email ?? decoded.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, package5PriceCents, package10PriceCents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update package pricing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
