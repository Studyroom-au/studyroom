import { NextResponse } from "next/server";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

interface Session {
  tutorId: string;
  startAt: FirebaseFirestore.Timestamp;
  endAt: FirebaseFirestore.Timestamp;
  durationMinutes?: number;
  updatedAt?: FirebaseFirestore.Timestamp;
  // Add other fields as needed
}

function isAdminEmail(email?: string | null) {
  return (email || "").toLowerCase() === "lily.studyroom@gmail.com";
}

function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(req: Request) {
  try {
    const decoded = await verifyIdTokenFromRequest(req);
    const uid = decoded.uid;
    const admin = isAdminEmail(decoded.email ?? null);

    const body = await req.json();
    const { sessionId, startISO, endISO } = body ?? {};

    if (!sessionId || !startISO || !endISO) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const start = new Date(String(startISO));
    const end = new Date(String(endISO));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ code: "INVALID_TIME_RANGE", error: "Invalid date(s)" }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json({ code: "INVALID_TIME_RANGE", error: "End must be after start" }, { status: 400 });
    }

    const duration = minutesBetween(start, end);
    if (duration < 15) {
      return NextResponse.json({ code: "INVALID_TIME_RANGE", error: "Min duration is 15 minutes" }, { status: 400 });
    }
    if (duration > 240) {
      return NextResponse.json({ code: "MAX_DURATION_EXCEEDED", error: "Max duration is 4 hours" }, { status: 400 });
    }

    const db = getFirestore();
    const ref = db.collection("sessions").doc(String(sessionId));
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = snap.data() as Session;

    // Permission: tutor can only reschedule their own session; admin can reschedule any.
    if (!admin && session.tutorId !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Overlap protection (buffer of 10 min)
    const BUFFER_MIN = 10;
    const startBuf = new Date(start.getTime() - BUFFER_MIN * 60000);
    const endBuf = new Date(end.getTime() + BUFFER_MIN * 60000);

    // Firestore limitation: can’t do range on two different fields easily,
    // so we query by tutorId + startAt range, then filter overlaps in memory.
    const qSnap = await db
      .collection("sessions")
      .where("tutorId", "==", session.tutorId)
      .where("startAt", ">=", Timestamp.fromDate(startBuf))
      .where("startAt", "<=", Timestamp.fromDate(endBuf))
      .get();

    const conflicts = qSnap.docs
      .filter((d) => d.id !== String(sessionId))
      .map((d) => ({ id: d.id, data: d.data() as Session }))
      .filter((s) => {
        const sStart = s.data.startAt?.toDate?.() as Date | undefined;
        const sEnd = s.data.endAt?.toDate?.() as Date | undefined;
        if (!sStart || !sEnd) return false;
        return overlaps(startBuf, endBuf, sStart, sEnd);
      });

    // Admin can override (but we warn). Tutors cannot.
    if (conflicts.length > 0 && !admin) {
      return NextResponse.json(
        { code: "SESSION_OVERLAP", error: "Overlaps another session" },
        { status: 409 }
      );
    }

    await ref.update({
      startAt: Timestamp.fromDate(start),
      endAt: Timestamp.fromDate(end),
      durationMinutes: duration,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      ok: true,
      warning: conflicts.length > 0 ? "OVERLAP_ADMIN_OVERRIDE" : null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message ?? "Unauthorized" }, { status: 401 });
  }
}
