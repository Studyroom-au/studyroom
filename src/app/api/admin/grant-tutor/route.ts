import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ADMIN_EMAILS = new Set(["lily.studyroom@gmail.com"]);

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // 1. Verify caller is admin
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const callerEmail = (decoded.email || "").toLowerCase();
    const isAdmin = decoded.role === "admin" || ALLOWED_ADMIN_EMAILS.has(callerEmail);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Parse body
    const body = (await req.json().catch(() => ({}))) as { email?: string; action?: "grant" | "revoke" };
    const { email, action = "grant" } = body;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // 3. Look up user by email via Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch {
      return NextResponse.json(
        { error: `No Studyroom account found for ${email}. The user needs to sign up first.` },
        { status: 404 }
      );
    }

    const uid = userRecord.uid;
    const displayName = userRecord.displayName || email.split("@")[0];
    const newRole = action === "grant" ? "tutor" : "student";

    // 4. Update Firestore user document
    await adminDb.collection("users").doc(uid).set(
      { role: newRole, email, updatedAt: new Date() },
      { merge: true }
    );

    // 5. Update roles collection
    await adminDb.collection("roles").doc(uid).set(
      { role: newRole, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    // 6. If granting tutor access, generate a one-time access code
    let accessCode: string | null = null;
    if (action === "grant") {
      accessCode = "TUTOR-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      await adminDb.collection("tutorAccessCodes").add({
        code: accessCode,
        tutorEmail: email,
        used: false,
        createdAt: FieldValue.serverTimestamp(),
        expiresAfterHours: 48,
      });
    }

    return NextResponse.json({ ok: true, uid, email, displayName, newRole, accessCode });
  } catch (err) {
    console.error("[grant-tutor]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
