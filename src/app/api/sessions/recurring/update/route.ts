import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    if (!auth || !db) throw new Error("Missing config");

    const token = req.headers.get("authorization")?.split(" ")[1];
    if (!token) throw new Error("Missing token");

    await auth.verifyIdToken(token);

    const body = await req.json();
    const {
      sessionId,
      startISO,
      endISO,
      editFuture,
    } = body;

    const sessionRef = db.collection("sessions").doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = snap.data() as {
      seriesKey: string;
      startAt: Timestamp;
      [key: string]: unknown;
    };


    const newStart = new Date(startISO);
    const newEnd = new Date(endISO);
    const durationMinutes =
      (newEnd.getTime() - newStart.getTime()) / 60000;

    if (!editFuture) {
      await sessionRef.update({
        startAt: Timestamp.fromDate(newStart),
        endAt: Timestamp.fromDate(newEnd),
        durationMinutes,
        updatedAt: Timestamp.now(),
      });
    } else {
      const seriesKey = session.seriesKey;

      const futureSnap = await db
        .collection("sessions")
        .where("seriesKey", "==", seriesKey)
        .where("startAt", ">=", session.startAt)
        .get();

      const batch = db.batch();

      futureSnap.docs.forEach((doc) => {
        const old = doc.data();
        const diff =
          old.startAt.toDate().getDay() -
          session.startAt.toDate().getDay();

        const shiftedStart = new Date(
          newStart.getTime() + diff * 7 * 24 * 60 * 60 * 1000
        );

        const shiftedEnd = new Date(
          shiftedStart.getTime() + durationMinutes * 60000
        );

        batch.update(doc.ref, {
          startAt: Timestamp.fromDate(shiftedStart),
          endAt: Timestamp.fromDate(shiftedEnd),
          durationMinutes,
          updatedAt: Timestamp.now(),
        });
      });

      await batch.commit();
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errorMessage =
      typeof e === "object" && e !== null && "message" in e
        ? (e as { message?: string }).message
        : undefined;
    return NextResponse.json(
      { error: errorMessage ?? "Update failed" },
      { status: 500 }
    );
  }
}
