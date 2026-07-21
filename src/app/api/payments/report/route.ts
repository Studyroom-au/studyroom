import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";

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

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const isAdmin = isAdminEmail(user.email);
    if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const fromISO = String(body?.fromISO || "");
    const toISO = String(body?.toISO || "");

    const from = new Date(fromISO);
    const to = new Date(toISO);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured.");

    const snap = await db
      .collection("sessions")
      .where("startAt", ">=", from)
      .where("startAt", "<", to)
      .get();

    // Release 1A (A4): tutor pay is never estimated. Only a session with a real,
    // recorded amountCents contributes to totalCents; everything else is counted
    // separately as "unavailable" so the report never silently fabricates a figure.
    // (As of Release 1A, amountCents is not yet written by the billing engine for
    // any session, so unavailableSessions will typically equal sessions for now —
    // this is expected until Release 2's tutor-pay snapshot work lands.)
    const byTutor: Record<
      string,
      { tutorId: string; sessions: number; totalCents: number; unavailableSessions: number }
    > = {};

    for (const d of snap.docs) {
      const s = d.data() as { tutorId?: string; amountCents?: number };
      const tutorId = String(s.tutorId || "");
      if (!tutorId) continue;

      if (!byTutor[tutorId]) {
        byTutor[tutorId] = { tutorId, sessions: 0, totalCents: 0, unavailableSessions: 0 };
      }
      byTutor[tutorId].sessions += 1;

      if (typeof s.amountCents === "number") {
        byTutor[tutorId].totalCents += s.amountCents;
      } else {
        byTutor[tutorId].unavailableSessions += 1;
      }
    }

    return NextResponse.json({ ok: true, byTutor: Object.values(byTutor) });
  } catch (e: unknown) {
    console.error("[payments/report]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
