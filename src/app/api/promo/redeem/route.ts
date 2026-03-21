import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();
    if (!db) throw new Error("DB not configured");

    const { code } = await req.json() as { code?: string };
    if (!code?.trim()) {
      return NextResponse.json({ error: "Please enter a promo code." }, { status: 400 });
    }

    // Find the code
    const snap = await db
      .collection("promoCodes")
      .where("code", "==", code.trim().toUpperCase())
      .where("active", "==", true)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { error: "Invalid promo code. Please check and try again." },
        { status: 400 }
      );
    }

    const codeDoc = snap.docs[0];
    const codeData = codeDoc.data();

    // Check expiry
    if (codeData.expiresAt) {
      const expiry = codeData.expiresAt.toDate?.() ?? new Date(codeData.expiresAt);
      if (new Date() > expiry) {
        return NextResponse.json(
          { error: "This promo code has expired." },
          { status: 400 }
        );
      }
    }

    // Check max uses
    if (codeData.maxUses !== null && codeData.maxUses !== undefined) {
      if ((codeData.usedCount ?? 0) >= codeData.maxUses) {
        return NextResponse.json(
          { error: "This promo code has reached its maximum uses." },
          { status: 400 }
        );
      }
    }

    // Check user hasn't already used a promo code or has an active subscription
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data();
    if (userData?.subscriptionStatus === "active") {
      return NextResponse.json(
        { error: "Your account already has an active subscription." },
        { status: 400 }
      );
    }
    if (userData?.subscriptionStatus === "trial") {
      return NextResponse.json(
        { error: "You already have an active trial." },
        { status: 400 }
      );
    }

    // Calculate trial end date
    const trialDays = codeData.trialDays ?? 7;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // Grant trial access
    await db.collection("users").doc(uid).set({
      subscriptionStatus: "trial",
      trialEndsAt,
      trialStartedAt: FieldValue.serverTimestamp(),
      promoCode: code.trim().toUpperCase(),
      trialWarningEmailSent: false,
    }, { merge: true });

    // Increment used count on code
    await codeDoc.ref.update({
      usedCount: FieldValue.increment(1),
    });

    // Set student role if not already set
    const roleSnap = await db.collection("roles").doc(uid).get();
    if (!roleSnap.exists || !roleSnap.data()?.role) {
      await db.collection("roles").doc(uid).set(
        { role: "student" },
        { merge: true }
      );
    }

    return NextResponse.json({
      ok: true,
      trialEndsAt: trialEndsAt.toISOString(),
      trialDays,
    });
  } catch (err) {
    console.error("[promo/redeem]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
