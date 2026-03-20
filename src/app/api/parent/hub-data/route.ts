import { NextRequest, NextResponse } from "next/server";
import { verifyIdTokenFromRequest, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    // 1. Verify auth token
    let decoded: Awaited<ReturnType<typeof verifyIdTokenFromRequest>>;
    try {
      decoded = await verifyIdTokenFromRequest(req);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parentEmail = decoded.email?.toLowerCase() ?? "";
    if (!parentEmail) {
      return NextResponse.json({ error: "No email on token" }, { status: 401 });
    }

    const db = getAdminDb();

    // 2. Find client record by parent email
    const clientSnap = await db
      .collection("clients")
      .where("parentEmail", "==", parentEmail)
      .limit(1)
      .get();

    if (clientSnap.empty) {
      return NextResponse.json({ error: "not_linked" }, { status: 404 });
    }

    const clientData = clientSnap.docs[0].data();
    const clientId = clientSnap.docs[0].id;

    // 3. Find student linked to this client
    const studentSnap = await db
      .collection("students")
      .where("clientId", "==", clientId)
      .limit(1)
      .get();

    if (studentSnap.empty) {
      return NextResponse.json({ error: "not_linked" }, { status: 404 });
    }

    const studentData = studentSnap.docs[0].data();
    const studentId = studentSnap.docs[0].id;
    const hubUid = String(studentData.hubUid ?? "");

    // 4. Load upcoming deadlines from student's hub account
    let upcoming: Array<{
      id: string;
      title: string;
      subject: string;
      dueDate: string;
      type: string;
      completed: boolean;
    }> = [];

    if (hubUid) {
      const upSnap = await db
        .collection("users")
        .doc(hubUid)
        .collection("upcoming")
        .where("completed", "==", false)
        .orderBy("dueDate", "asc")
        .limit(10)
        .get();

      upcoming = upSnap.docs.map((d) => ({
        id: d.id,
        title: String(d.data().title ?? ""),
        subject: String(d.data().subject ?? ""),
        dueDate: String(d.data().dueDate ?? ""),
        type: String(d.data().type ?? "assessment"),
        completed: Boolean(d.data().completed),
      }));
    }

    // 5. Load recent sessions for this student
    const sessionsSnap = await db
      .collection("sessions")
      .where("studentId", "==", studentId)
      .orderBy("startAt", "desc")
      .limit(10)
      .get();

    const sessions = sessionsSnap.docs.map((d) => {
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

    // 6. Return everything
    return NextResponse.json({
      ok: true,
      student: {
        id: studentId,
        studentName: String(studentData.studentName ?? ""),
        yearLevel: String(studentData.yearLevel ?? ""),
        subjects: studentData.subjects ?? [],
      },
      parent: {
        parentName: String(clientData.parentName ?? ""),
        parentEmail,
      },
      upcoming,
      sessions,
    });
  } catch (err) {
    console.error("[parent/hub-data]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
