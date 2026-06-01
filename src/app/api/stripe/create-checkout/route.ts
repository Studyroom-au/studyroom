import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminAuth } from "@/lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email ?? "";

    // Callers may override success/cancel URLs (e.g. parent portal → /parent).
    let successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`;
    let cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/subscribe`;
    try {
      const body = await req.json() as { successUrl?: string; cancelUrl?: string };
      if (body.successUrl) successUrl = body.successUrl;
      if (body.cancelUrl) cancelUrl = body.cancelUrl;
    } catch { /* no body is fine */ }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_MONTHLY_PRICE_ID!,
          quantity: 1,
        },
      ],
      metadata: { uid, email },
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { uid, email },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[create-checkout]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
