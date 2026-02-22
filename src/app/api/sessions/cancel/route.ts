// src/app/api/sessions/cancel/route.ts
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m?.[1] || null;
}

async function requireUser(req: Request) {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin not configured.");

  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization token.");

  return await auth.verifyIdToken(token);
}

function isAdminEmail(email?: string | null) {
  return (email || "").toLowerCase() === "lily.studyroom@gmail.com";
}

async function isTutorOrAdmin(uid: string, email?: string | null) {
  if (isAdminEmail(email)) return { role: "admin" as const };

  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");

  const roleSnap = await db.collection("roles").doc(uid).get();
  const role = roleSnap.exists ? (roleSnap.data()?.role as string) : "student";
  if (role !== "tutor" && role !== "admin") throw new Error("Not permitted.");
  return { role: role as "tutor" | "admin" };
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { role } = await isTutorOrAdmin(user.uid, user.email ?? null);

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "");
    const reason = String(body?.reason ?? "PARENT").toUpperCase() as "PARENT" | "STUDYROOM";

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured.");

    const ref = db.collection("sessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const session = snap.data() as Record<string, unknown>;


    // Tutors can only cancel their own sessions
    if (role !== "admin" && session.tutorId !== user.uid) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const start = session.startAt && typeof session.startAt === 'object' && 'toDate' in session.startAt
      ? (session.startAt as Timestamp).toDate()
      : null;
    if (!start) return NextResponse.json({ error: "Session missing startAt" }, { status: 400 });

    const now = new Date();
    const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

    const status =
      reason === "STUDYROOM" ? "CANCELLED_STUDYROOM" : "CANCELLED_PARENT";

    const currentBilling = String(session.billingStatus || "NOT_BILLED");

    // Policy: within 12 hours triggers invoice if not already billed
    const within12 = hoursUntil <= 12;

    let billingStatus = currentBilling;
    let invoiceTriggered = false;

    if (within12) {
      if (currentBilling === "NOT_BILLED") {
        billingStatus = "READY_TO_INVOICE";
        // optional: immediately invoice (requested behaviour)
        invoiceTriggered = true;
      }
    } else {
      // outside 12 hours: mark internally as credited (Xero credit/refund is manual)
      if (currentBilling === "INVOICED") billingStatus = "CREDITED";
    }

    await ref.update({
      status,
      billingStatus,
      cancelledAt: Timestamp.fromDate(new Date()),
      cancelReason: within12
        ? "Session fee — late cancellation within 12 hours (as per policy)"
        : "Cancelled outside 12 hours — credit/refund handled manually if applicable",

      updatedAt: Timestamp.fromDate(new Date()),
    });

    return NextResponse.json({ ok: true, within12, invoiceTriggered });
  } catch (e: unknown) {
    console.error("[sessions/cancel]", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
