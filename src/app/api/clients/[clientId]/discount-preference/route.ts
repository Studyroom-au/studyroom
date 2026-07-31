import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import type { DiscountType } from "@/lib/studyroom/billing";

// Release 1B, Stage 5: the ONLY write path for a family's discountPreference*
// fields on clients/{clientId} — firestore.rules carves these five fields out
// of admin's normal client-side write grant (see the clients/{clientId} rule).
// This is a non-binding default/memory only: it is shown to admin at package
// creation/renewal for an explicit keep/change/remove decision, never applied
// automatically, and never read by any pricing/invoicing code.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const { clientId } = await params;
    if (!clientId) return NextResponse.json({ error: "Missing clientId." }, { status: 400 });

    const token = readBearerToken(req);
    if (!token) return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      discountType?: DiscountType | null;
      discountValue?: number | null;
      discountReason?: string | null;
    };

    const discountType = body.discountType ?? null;
    if (discountType !== null && discountType !== "percent" && discountType !== "fixed") {
      return NextResponse.json({ error: 'discountType must be "percent", "fixed", or null.' }, { status: 400 });
    }

    let discountValue: number | null = null;
    if (discountType !== null) {
      discountValue = Number(body.discountValue);
      if (!Number.isFinite(discountValue)) {
        return NextResponse.json({ error: "discountValue must be a number when discountType is set." }, { status: 400 });
      }
      if (discountType === "percent" && (discountValue < 0 || discountValue > 100)) {
        return NextResponse.json({ error: "A percentage preference must be between 0 and 100." }, { status: 400 });
      }
      if (discountType === "fixed" && discountValue < 0) {
        return NextResponse.json({ error: "A fixed preference cannot be negative." }, { status: 400 });
      }
    }

    const clientRef = db.collection("clients").doc(clientId);
    const snap = await clientRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    await clientRef.set(
      {
        discountPreferenceType: discountType,
        discountPreferenceValue: discountValue,
        discountPreferenceReason: body.discountReason || null,
        discountPreferenceUpdatedBy: decoded.email || decoded.uid,
        discountPreferenceUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, discountType, discountValue });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update discount preference";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
