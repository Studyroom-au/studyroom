import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { applySessionAction } from "@/lib/studyroom/serverBilling";
import { getCasualPricingTiers } from "@/lib/studyroom/casualPricing";

// Release 1B.1: "Complete on behalf of tutor" — admin-only. Delegates
// entirely to applySessionAction with adminCompletion populated, so the
// admin-authored note, the session status change, the entitlement
// deduction/invoice write, and the admin-override audit metadata all land in
// ONE Firestore transaction (see serverBilling.ts). This route no longer
// performs any of its own Firestore reads/writes outside that call — it only
// validates the request shape and triggers the post-transaction Xero
// side-effect, exactly like the tutor-facing /api/sessions/status route
// does for a normal completion.
//
// Idempotent by construction: applySessionAction itself refuses (before any
// write) if the session is already completed/no-show/cancelled, so a repeat
// submission can never double-deduct an entitlement or create a second
// invoice — and a genuine mid-transaction failure leaves nothing partial,
// since Firestore transactions are all-or-nothing.

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

    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string;
      outcome?: string; // "completed" | "no_show"
      note?: string;
      actualCompletionDate?: string | null;
      reason?: string;
    };

    const sessionId = String(body.sessionId ?? "").trim();
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });

    const outcome = body.outcome === "no_show" ? "no_show" : "completed";
    const note = String(body.note ?? "").trim();
    if (!note) return NextResponse.json({ error: "A session note is required." }, { status: 400 });
    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "A reason is required for an admin override." }, { status: 400 });

    let actualCompletionDate: Date | null = null;
    if (body.actualCompletionDate) {
      actualCompletionDate = new Date(body.actualCompletionDate);
      if (isNaN(actualCompletionDate.getTime())) {
        return NextResponse.json({ error: "actualCompletionDate must be a valid date." }, { status: 400 });
      }
    }

    const casualPricingTiers = await getCasualPricingTiers(db);

    const result = await applySessionAction({
      sessionId,
      action: outcome === "no_show" ? "no_show" : "complete",
      user: decoded,
      role: "admin",
      casualPricingTiers,
      adminCompletion: { note, reason, actualCompletionDate },
    });

    // Same fire-and-forget side effects the tutor-facing status route
    // triggers on a real completion — kept consistent so an admin-completed
    // casual session still gets its Xero draft created automatically. This
    // is deliberately OUTSIDE the Firestore transaction (an external network
    // call cannot be part of it) — the local invoice document itself is
    // already safely created exactly once by the transaction above; this
    // call only pushes that already-committed invoice to Xero.
    const secret = process.env.INTERNAL_API_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    if (outcome === "completed" && result.billingOutcome === "invoice" && result.invoiceId && secret) {
      fetch(`${baseUrl}/api/billing/push-invoice-to-xero`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-call": secret },
        body: JSON.stringify({ invoiceId: result.invoiceId }),
      }).catch((err) => console.error("[sessions/admin-complete] xero draft creation failed:", err));
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[sessions/admin-complete]", err);
    const message = err instanceof Error ? err.message : "Failed to complete session on behalf of tutor";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
