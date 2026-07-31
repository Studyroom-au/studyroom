import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { isMarkPaidBlocked } from "@/lib/studyroom/billing";

// Release 1B, Stage 7: the smallest safe fix for payment truth. Traced every
// InvoiceStatus writer in the codebase — "paid" is never once assigned
// anywhere; the admin Invoices page's own copy admits no Xero webhook sync
// exists. Rather than building that sync (a real scope expansion), this is a
// manual, admin-only, attributable record of a fact Lily/Tiara have already
// confirmed in Xero or their bank — not an automated reconciliation.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const { invoiceId } = await params;
    const token = readBearerToken(req);
    if (!token) return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const snap = await invoiceRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    const status = String(snap.data()?.status ?? "");
    if (isMarkPaidBlocked(status)) {
      return NextResponse.json({ error: `Cannot mark a "${status}" invoice as paid.` }, { status: 400 });
    }

    await invoiceRef.set(
      {
        status: "paid",
        balanceCents: 0,
        paidAt: FieldValue.serverTimestamp(),
        paidRecordedBy: decoded.email || decoded.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to mark invoice as paid";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
