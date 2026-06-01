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

    const codeUpper = code.trim().toUpperCase();

    // Find the active code
    const snap = await db
      .collection("promoCodes")
      .where("code", "==", codeUpper)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { error: "Invalid promo code. Please check and try again." },
        { status: 400 }
      );
    }

    const codeDocRef = snap.docs[0].ref;
    const codeData = snap.docs[0].data();

    // Check expiry
    if (codeData.expiresAt) {
      const expiry = codeData.expiresAt.toDate?.() ?? new Date(codeData.expiresAt);
      if (new Date() > expiry) {
        return NextResponse.json({ error: "This promo code has expired." }, { status: 400 });
      }
    }

    // Check if this user already redeemed this specific code
    const redeemedBy: string[] = codeData.redeemedBy ?? [];
    if (redeemedBy.includes(uid)) {
      return NextResponse.json({ error: "You have already used this code." }, { status: 400 });
    }

    // Get user data for eligibility check
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() ?? {};
    const subStatus: string = userData.subscriptionStatus ?? "";

    // Eligibility check — default to new_users_only for codes without the field
    const eligibility: string = codeData.eligibility ?? "new_users_only";
    if (eligibility === "new_users_only") {
      const hasActiveSub = subStatus === "active";
      const hasActiveTrial =
        subStatus === "trial" &&
        userData.trialEndsAt &&
        new Date() < (userData.trialEndsAt.toDate?.() ?? new Date(userData.trialEndsAt));
      if (hasActiveSub || hasActiveTrial) {
        return NextResponse.json(
          { error: "This code is for new users only." },
          { status: 400 }
        );
      }
    }

    // Calculate access duration — full_access gets a very long trial
    const promoType: string = codeData.type ?? "free_trial";
    const durationDays: number =
      promoType === "full_access"
        ? 3650
        : (codeData.durationDays ?? codeData.trialDays ?? 7);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + durationDays);

    // Atomic transaction: check maxRedemptions, update code, grant user access
    const txResult = await db.runTransaction(async (tx) => {
      const freshCodeDoc = await tx.get(codeDocRef);
      if (!freshCodeDoc.exists) {
        return { error: "Promo code no longer exists." };
      }
      const freshData = freshCodeDoc.data()!;

      // Re-check duplicate inside transaction to handle concurrent redemptions
      const freshRedeemedBy: string[] = freshData.redeemedBy ?? [];
      if (freshRedeemedBy.includes(uid)) {
        return { error: "You have already used this code." };
      }

      // Check maxRedemptions atomically — supports both old (maxUses) and new schema
      const maxR = freshData.maxRedemptions ?? freshData.maxUses ?? null;
      const countR = freshData.redemptionCount ?? freshData.usedCount ?? 0;
      if (maxR !== null && countR >= maxR) {
        return { error: "This promo code has reached its maximum uses." };
      }

      // Update code: increment count and track who redeemed
      tx.update(codeDocRef, {
        redemptionCount: FieldValue.increment(1),
        redeemedBy: FieldValue.arrayUnion(uid),
      });

      // Grant access on user document
      const userRef = db.collection("users").doc(uid);
      tx.set(
        userRef,
        {
          subscriptionStatus: "trial",
          trialEndsAt,
          trialStartedAt: FieldValue.serverTimestamp(),
          promoCode: codeUpper,
          trialWarningEmailSent: false,
        },
        { merge: true }
      );

      return { ok: true };
    });

    if ("error" in txResult && txResult.error) {
      return NextResponse.json({ error: txResult.error }, { status: 400 });
    }

    // Set student role if not already set (idempotent, outside transaction)
    const roleSnap = await db.collection("roles").doc(uid).get();
    if (!roleSnap.exists || !roleSnap.data()?.role) {
      await db.collection("roles").doc(uid).set({ role: "student" }, { merge: true });
    }

    return NextResponse.json({ ok: true, trialEndsAt: trialEndsAt.toISOString(), durationDays });
  } catch (err) {
    console.error("[promo/redeem]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
