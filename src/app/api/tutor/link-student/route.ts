import { NextRequest, NextResponse } from "next/server";
import { verifyIdTokenFromRequest, getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const ADMIN_EMAIL = "lily.studyroom@gmail.com";

export async function POST(req: NextRequest) {
  try {
    let decoded: Awaited<ReturnType<typeof verifyIdTokenFromRequest>>;
    try {
      decoded = await verifyIdTokenFromRequest(req);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callerUid = decoded.uid;
    const callerEmail = (decoded.email ?? "").toLowerCase().trim();
    const isAdmin = callerEmail === ADMIN_EMAIL;

    const body = await req.json() as {
      studentId?: unknown;
      hubEmail?: unknown;
      force?: unknown;
    };

    const studentId = String(body.studentId ?? "").trim();
    const hubEmail = String(body.hubEmail ?? "").trim().toLowerCase();
    const force = Boolean(body.force);

    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });
    if (!hubEmail) return NextResponse.json({ error: "hubEmail required" }, { status: 400 });

    const db = getAdminDb();

    // ── 1. Verify caller is tutor or admin ────────────────────────────────────

    if (!isAdmin) {
      const callerRoleSnap = await db.collection("roles").doc(callerUid).get();
      const callerRole = String(callerRoleSnap.data()?.role ?? "");
      if (callerRole !== "tutor" && callerRole !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // ── 2. Load and verify the student record ────────────────────────────────

    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const studentData = studentSnap.data() as {
      assignedTutorId?: string | null;
      assignedTutorEmail?: string | null;
      hubUid?: string | null;
      hubEmail?: string | null;
    };

    // ── 3. Confirm caller is the assigned tutor (or admin) ───────────────────

    if (!isAdmin) {
      const byId = studentData.assignedTutorId === callerUid;
      const byEmail =
        studentData.assignedTutorEmail?.toLowerCase().trim() === callerEmail;
      if (!byId && !byEmail) {
        return NextResponse.json(
          { error: "Forbidden — this student is not assigned to you." },
          { status: 403 }
        );
      }
    }

    // ── 4. Resolve the target Studyroom account by email ─────────────────────

    let targetUid: string;
    try {
      const authUser = await getAdminAuth().getUserByEmail(hubEmail);
      targetUid = authUser.uid;
    } catch {
      return NextResponse.json(
        { error: "No Studyroom account found for that email address." },
        { status: 404 }
      );
    }

    // ── 5. Verify the target account has the student role ────────────────────

    const targetRoleSnap = await db.collection("roles").doc(targetUid).get();
    const targetRole = String(targetRoleSnap.data()?.role ?? "");

    if (targetRole !== "student") {
      if (!targetRole) {
        return NextResponse.json(
          { error: "That account has not been set up as a student account yet." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: `That Studyroom account is registered as a ${targetRole}, not a student. Only student accounts can be linked here.`,
        },
        { status: 400 }
      );
    }

    // ── 6. Handle already-linked cases ───────────────────────────────────────

    const currentHubUid = studentData.hubUid ?? null;

    // Idempotent — already linked to the same account
    if (currentHubUid === targetUid) {
      return NextResponse.json({ ok: true, noChange: true });
    }

    // Linked to a different account — require explicit force
    if (currentHubUid && !force) {
      return NextResponse.json(
        { error: "already_linked", currentHubEmail: studentData.hubEmail ?? "" },
        { status: 409 }
      );
    }

    // ── 7. Write the link ─────────────────────────────────────────────────────

    await db.collection("students").doc(studentId).update({
      hubUid: targetUid,
      hubEmail: hubEmail,
      linkedAt: FieldValue.serverTimestamp(),
      linkedBy: callerUid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, hubUid: targetUid, hubEmail });
  } catch (err) {
    console.error("[tutor/link-student]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
