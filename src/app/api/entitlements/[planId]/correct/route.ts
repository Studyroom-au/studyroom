import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { correctEntitlementBalance } from "@/lib/studyroom/planCommerce";

// Release 1B addendum: admin-only, server-validated correction to a package's
// remaining-session balance — for genuine operational mistakes (a session
// booked/completed incorrectly, a credit that needs restoring), not for
// rewriting session history. See planCommerce.ts for the transaction.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const { planId } = await params;
    const token = readBearerToken(req);
    if (!token) return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { delta?: number; reason?: string };

    const result = await correctEntitlementBalance(db, {
      planId,
      delta: Number(body.delta),
      reason: String(body.reason ?? ""),
      actor: decoded.email || decoded.uid,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to correct balance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
