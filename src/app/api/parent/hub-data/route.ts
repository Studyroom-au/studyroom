import { NextRequest, NextResponse } from "next/server";
import { verifyIdTokenFromRequest, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    let decoded: Awaited<ReturnType<typeof verifyIdTokenFromRequest>>;
    try {
      decoded = await verifyIdTokenFromRequest(req);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const parentUid = decoded.uid;
    const parentEmail = decoded.email?.toLowerCase() ?? "";

    // 1. Find client — prefer parentUid (stable), fall back to parentEmail
    let clientSnap = await db
      .collection("clients")
      .where("parentUid", "==", parentUid)
      .limit(1)
      .get();

    if (clientSnap.empty && parentEmail) {
      clientSnap = await db
        .collection("clients")
        .where("parentEmail", "==", parentEmail)
        .limit(1)
        .get();
    }

    if (clientSnap.empty) {
      return NextResponse.json({ error: "not_linked" }, { status: 404 });
    }

    const clientData = clientSnap.docs[0].data();
    const clientId = clientSnap.docs[0].id;

    // 2. Get ALL students for this client (no limit)
    const studentsSnap = await db
      .collection("students")
      .where("clientId", "==", clientId)
      .get();

    if (studentsSnap.empty) {
      return NextResponse.json({ error: "not_linked" }, { status: 404 });
    }

    // Sort by name in memory — avoids needing a composite Firestore index
    const studentDocs = studentsSnap.docs.slice().sort((a, b) =>
      String(a.data().studentName ?? "").localeCompare(String(b.data().studentName ?? ""))
    );

    // 3. Load tasks, upcoming, and sessions for every student in parallel
    const students = await Promise.all(
      studentDocs.map(async (sDoc) => {
        const sData = sDoc.data();
        const studentId = sDoc.id;
        const hubUid = String(sData.hubUid ?? "");

        let upcoming: Array<{
          id: string;
          title: string;
          subject: string;
          dueDate: string;
          type: string;
          completed: boolean;
        }> = [];

        let tasks: Array<{
          id: string;
          title: string;
          done: boolean;
          source?: string;
          dueDate?: string | null;
        }> = [];

        let pomoHistory: Array<{
          id: string;
          date: string;
          durationMs: number;
          completedAt: string | null;
        }> = [];

        let moodLogs: Array<{
          id: string;
          date: string;
          mood: string;
          note: string | null;
          createdAt: string | null;
        }> = [];

        if (hubUid) {
          const [upSnap, tasksSnap] = await Promise.all([
            db
              .collection("users")
              .doc(hubUid)
              .collection("upcoming")
              .where("completed", "==", false)
              .orderBy("dueDate", "asc")
              .limit(20)
              .get(),
            db
              .collection("users")
              .doc(hubUid)
              .collection("tasks")
              .orderBy("createdAt", "desc")
              .limit(30)
              .get(),
          ]);

          upcoming = upSnap.docs.map((d) => ({
            id: d.id,
            title: String(d.data().title ?? ""),
            subject: String(d.data().subject ?? ""),
            dueDate: String(d.data().dueDate ?? ""),
            type: String(d.data().type ?? "assessment"),
            completed: Boolean(d.data().completed),
          }));

          tasks = tasksSnap.docs.map((d) => ({
            id: d.id,
            title: String(d.data().title ?? ""),
            done: Boolean(d.data().done),
            source: d.data().source ? String(d.data().source) : undefined,
            dueDate: d.data().dueDate ? String(d.data().dueDate) : null,
          }));

          // History queries — gracefully degrade on missing index or empty collection
          const [pomoResult, moodResult] = await Promise.allSettled([
            db
              .collection("users")
              .doc(hubUid)
              .collection("pomoHistory")
              .orderBy("completedAt", "desc")
              .limit(5)
              .get(),
            db
              .collection("users")
              .doc(hubUid)
              .collection("moodLogs")
              .orderBy("createdAt", "desc")
              .limit(5)
              .get(),
          ]);

          if (pomoResult.status === "fulfilled") {
            pomoHistory = pomoResult.value.docs.map((d) => ({
              id: d.id,
              date: String(d.data().date ?? ""),
              durationMs: Number(d.data().durationMs ?? 0),
              completedAt: d.data().completedAt?.toDate?.()?.toISOString() ?? null,
            }));
          } else {
            console.warn("[parent/hub-data] pomoHistory query failed:", pomoResult.reason);
          }

          if (moodResult.status === "fulfilled") {
            moodLogs = moodResult.value.docs.map((d) => ({
              id: d.id,
              date: String(d.data().date ?? ""),
              mood: String(d.data().mood ?? ""),
              note: d.data().note ? String(d.data().note) : null,
              createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
            }));
          } else {
            console.warn("[parent/hub-data] moodLogs query failed:", moodResult.reason);
          }
        }

        // Sessions query requires a composite index (studentId + startAt).
        // Gracefully degrade if the index doesn't exist yet.
        let sessions: Array<{
          id: string;
          startAt: string | null;
          durationMinutes: number;
          status: string;
          modality: string;
          notes: string;
        }> = [];
        try {
          const sessionsSnap = await db
            .collection("sessions")
            .where("studentId", "==", studentId)
            .orderBy("startAt", "desc")
            .limit(10)
            .get();
          sessions = sessionsSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              startAt: data.startAt?.toDate?.()?.toISOString() ?? null,
              durationMinutes: Number(data.durationMinutes ?? 60),
              status: String(data.status ?? "scheduled"),
              modality: String(data.modality ?? data.mode ?? ""),
              notes: String(data.notes ?? ""),
            };
          });
        } catch (sessErr) {
          console.warn("[parent/hub-data] sessions query failed (index may be missing):", sessErr);
        }

        return {
          id: studentId,
          hubUid,
          studentName: String(sData.studentName ?? ""),
          yearLevel: String(sData.yearLevel ?? ""),
          subjects: (sData.subjects as string[]) ?? [],
          roomAccessEnabled: sData.roomAccessEnabled !== false,
          upcoming,
          tasks,
          sessions,
          pomoHistory,
          moodLogs,
        };
      })
    );

    // Load parent's subscription status so the parent portal can show billing info.
    const parentUserSnap = await db.collection("users").doc(parentUid).get();
    const parentUserData = parentUserSnap.data() ?? {};
    const subStatus = String(parentUserData.subscriptionStatus ?? "");
    const trialEndsAtTs = parentUserData.trialEndsAt;
    const trialEndsAt: string | null = trialEndsAtTs?.toDate?.()?.toISOString() ?? null;
    const stripeCustomerId = String(parentUserData.stripeCustomerId ?? "");

    return NextResponse.json({
      ok: true,
      parent: {
        parentName: String(clientData.parentName ?? ""),
        parentEmail: String(clientData.parentEmail ?? parentEmail),
      },
      students,
      subscription: {
        status: subStatus,
        trialEndsAt,
        stripeCustomerId,
      },
    });
  } catch (err) {
    console.error("[parent/hub-data]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
