import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[webhook] signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getAdminDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid;
    const stripeCustomerId = String(session.customer ?? "");
    const subscriptionId = String(session.subscription ?? "");

    if (uid) {
      await db.collection("users").doc(uid).set({
        subscriptionStatus: "active",
        stripeCustomerId,
        stripeSubscriptionId: subscriptionId,
        subscribedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Set student role
      await db.collection("roles").doc(uid).set({
        role: "student",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.paused"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const uid = sub.metadata?.uid;
    if (uid) {
      await db.collection("users").doc(uid).set({
        subscriptionStatus: "cancelled",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uid = (invoice as any).subscription_details?.metadata?.uid;
    if (uid) {
      await db.collection("users").doc(uid).set({
        subscriptionStatus: "past_due",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  return NextResponse.json({ received: true });
}
