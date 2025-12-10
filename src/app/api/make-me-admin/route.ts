// src/app/api/make-me-admin/route.ts
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    if (!auth) {
      return NextResponse.json(
        { error: "Admin SDK not available" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json({ error: "Missing UID" }, { status: 400 });
    }

    await auth.setCustomUserClaims(uid, { role: "admin" });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
