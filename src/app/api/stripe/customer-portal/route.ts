import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// POST /api/stripe/customer-portal
// Authenticated. Opens a Stripe billing portal session for the signed-in user.
// The user must have stripeCustomerId set (i.e. they have completed checkout before).
//
// Body: { returnUrl?: string }  — where Stripe redirects after the portal session.

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;

    let returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/hub/profile`;
    try {
      const body = await req.json() as { returnUrl?: string };
      if (body.returnUrl) returnUrl = body.returnUrl;
    } catch { /* no body is fine */ }

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const stripeCustomerId = String(userSnap.data()?.stripeCustomerId ?? "");

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Complete a subscription first." },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[customer-portal]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
