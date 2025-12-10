import { NextResponse } from "next/server";
import { getAdminAuth, getAdminApp } from "@/lib/firebaseAdmin";

/**
 * Only admins can promote/suspend/change roles.
 * Expected body:
 * {
 *   "uid": "userID",
 *   "role": "admin" | "tutor" | "student" | "suspended"
 * }
 */
export async function POST(req: Request) {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json(
      { error: "Admin SDK not initialised." },
      { status: 500 }
    );
  }

  let decoded;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Missing auth" }, { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    decoded = await adminAuth.verifyIdToken(token);

    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Read body
  const { uid, role } = await req.json();

  if (!uid || !role) {
    return NextResponse.json({ error: "Missing uid or role" }, { status: 400 });
  }

  try {
    await adminAuth.setCustomUserClaims(uid, { role });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to update role", details: String(e) },
      { status: 500 }
    );
  }
}
