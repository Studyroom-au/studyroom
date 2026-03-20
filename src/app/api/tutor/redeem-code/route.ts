import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function parseExpiry(value: unknown): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const userEmail = decoded.email?.toLowerCase().trim() ?? "";

    const body = (await req.json()) as { code?: string };
    const code = body.code?.trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Access code required." }, { status: 400 });
    }

    const db = getAdminDb();
    const codeSnap = await db.collection("tutorAccessCodes").where("code", "==", code).limit(1).get();
    if (codeSnap.empty) {
      return NextResponse.json(
        { error: "Invalid access code. Please check and try again." },
        { status: 400 }
      );
    }

    const codeDoc = codeSnap.docs[0];
    const codeData = codeDoc.data();

    if (codeData.used === true) {
      return NextResponse.json(
        { error: "This access code has already been used." },
        { status: 400 }
      );
    }

    const expiresAt = parseExpiry(codeData.expiresAt);
    if (expiresAt && new Date() > expiresAt) {
      return NextResponse.json(
        { error: "This access code has expired. Please contact Studyroom for a new one." },
        { status: 400 }
      );
    }

    const storedEmail = String(codeData.tutorEmail ?? "").toLowerCase().trim();
    if (storedEmail && storedEmail !== userEmail) {
      return NextResponse.json(
        { error: "This code was issued for a different email address." },
        { status: 400 }
      );
    }

    await db.collection("roles").doc(uid).set(
      {
        role: "tutor",
        grantedViaCode: codeDoc.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection("users").doc(uid).set(
      {
        subscriptionStatus: "tutor_access",
        onboardingComplete: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await codeDoc.ref.update({
      used: true,
      redeemedAt: FieldValue.serverTimestamp(),
      redeemedByUid: uid,
      redeemedByEmail: userEmail,
    });

    const leadsSnap = await db.collection("leads").where("email", "==", storedEmail || userEmail).get();
    if (!leadsSnap.empty) {
      await Promise.all(
        leadsSnap.docs
          .filter((lead) => {
            const type = String(lead.data().type ?? "");
            return type === "tutor_request" || type === "tutor_invite";
          })
          .map((lead) =>
            lead.ref.update({
              status: "active",
              tutorUid: uid,
              updatedAt: FieldValue.serverTimestamp(),
            })
          )
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[redeem-code]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
