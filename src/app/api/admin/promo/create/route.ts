import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.email !== "lily.studyroom@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) throw new Error("DB not configured");

    const body = await req.json() as {
      code?: string;
      trialDays?: number;
      maxUses?: number | null;
      expiresAt?: string | null;
    };

    if (!body.code?.trim()) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    // Check code doesn't already exist
    const existing = await db
      .collection("promoCodes")
      .where("code", "==", body.code.trim().toUpperCase())
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: "This code already exists" }, { status: 400 });
    }

    await db.collection("promoCodes").add({
      code: body.code.trim().toUpperCase(),
      trialDays: body.trialDays ?? 7,
      maxUses: body.maxUses ?? null,
      usedCount: 0,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: decoded.uid,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[promo/create]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
