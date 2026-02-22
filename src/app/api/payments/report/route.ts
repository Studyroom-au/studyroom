import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const isAdmin = (user.email || "").toLowerCase() === "lily.studyroom@gmail.com";
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

    const byTutor: Record<string, { tutorId: string; sessions: number; totalCents: number }> = {};

    for (const d of snap.docs) {
      const s = d.data() as any;
      const tutorId = String(s.tutorId || "");
      if (!tutorId) continue;

      const amountCents =
        typeof s.amountCents === "number"
          ? s.amountCents
          : Math.round(((Number(s.durationMinutes || 60) / 60) * 75) * 100);

      if (!byTutor[tutorId]) byTutor[tutorId] = { tutorId, sessions: 0, totalCents: 0 };
      byTutor[tutorId].sessions += 1;
      byTutor[tutorId].totalCents += amountCents;
    }

    return NextResponse.json({ ok: true, byTutor: Object.values(byTutor) });
  } catch (e: any) {
    console.error("[payments/report]", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
