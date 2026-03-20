import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { code } = await req.json() as { code?: string };
    if (!code?.trim()) return NextResponse.json({ error: "Code is required." }, { status: 400 });

    const db = getAdminDb();

    // Find the access code document
    const codeSnap = await db.collection("tutorAccessCodes")
      .where("code", "==", code.trim().toUpperCase())
      .where("used", "==", false)
      .limit(1)
      .get();

    if (codeSnap.empty) {
      return NextResponse.json({ error: "Invalid or already used code." }, { status: 400 });
    }

    const codeDoc = codeSnap.docs[0];
    const codeData = codeDoc.data();

    // Check expiry (48 hours)
    const createdAt = codeData.createdAt?.toDate?.() ?? new Date(0);
    const hoursSince = (Date.now() - createdAt.getTime()) / 3600000;
    if (hoursSince > 48) {
      return NextResponse.json({ error: "This code has expired. Contact admin for a new one." }, { status: 400 });
    }

    // Check the code belongs to this tutor's email (if email is stored on code)
    const codeEmail = String(codeData.tutorEmail ?? "");
    if (codeEmail && codeEmail !== decoded.email) {
      return NextResponse.json({ error: "This code is not valid for your account." }, { status: 403 });
    }

    // Mark code as used
    await codeDoc.ref.update({
      used: true,
      usedBy: uid,
      usedAt: FieldValue.serverTimestamp(),
    });

    // Grant tutor role
    await db.collection("roles").doc(uid).set({
      role: "tutor",
      grantedViaCode: codeDoc.id,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Mark user as not needing subscription
    await db.collection("users").doc(uid).set({
      subscriptionStatus: "tutor_access",
      onboardingComplete: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[redeem-code]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
