import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m?.[1] || null;
}

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const db = getAdminDb();
    if (!adminAuth || !db) {
      return NextResponse.json({ error: "Server not configured." }, { status: 500 });
    }

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
    }

    const user = await adminAuth.verifyIdToken(token);

    // Require tutor or admin role
    const isAdmin = (user.email || "").toLowerCase() === "lily.studyroom@gmail.com";
    if (!isAdmin) {
      const roleSnap = await db.collection("roles").doc(user.uid).get();
      const role = roleSnap.exists ? String(roleSnap.data()?.role ?? "") : "";
      if (role !== "tutor") {
        return NextResponse.json({ error: "Not permitted." }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const sessionRef = db.collection("sessions").doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const data = snap.data()!;

    // Tutor must own the session
    if (!isAdmin && data.tutorId !== user.uid) {
      return NextResponse.json({ error: "Not your session." }, { status: 403 });
    }

    // Only delete sessions that are still scheduled
    const statusNorm = String(data.status ?? "").toLowerCase();
    if (statusNorm !== "scheduled") {
      return NextResponse.json(
        { error: "Only sessions still in 'scheduled' status can be deleted." },
        { status: 400 }
      );
    }

    // Guard: reject if any billing has occurred
    if (data.invoiceId || data.billingOutcome) {
      return NextResponse.json(
        { error: "This session has billing data and cannot be deleted. Contact admin." },
        { status: 400 }
      );
    }

    await sessionRef.delete();

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[sessions/delete]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error." },
      { status: 500 }
    );
  }
}
