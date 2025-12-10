import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

const ALLOWED_EMAIL = "lily.studyroom@gmail.com"; // <-- CHANGE THIS!

export async function GET() {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json(
      { error: "Admin SDK missing environment vars." },
      { status: 500 }
    );
  }

  try {
    // Find the user by email
    const userRecord = await adminAuth.getUserByEmail(ALLOWED_EMAIL);

    // Apply the admin role
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: "admin" });

    return NextResponse.json({
      ok: true,
      email: ALLOWED_EMAIL,
      role: "admin",
      message: "Admin role applied successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to promote user", details: String(err) },
      { status: 500 }
    );
  }
}
