import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { computeAssignedTutorIds, shouldMirrorSingularTutor } from "@/lib/studyroom/clientTutorSync";

type Role = "student" | "tutor" | "admin";

type ClientDoc = {
  assignedTutorId?: string | null;
};

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

async function requireTutorOrAdmin(uid: string, email?: string | null) {
  if (isAdminEmail(email)) return { role: "admin" as const };

  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");

  const roleSnap = await db.collection("roles").doc(uid).get();
  const role = (roleSnap.exists ? (roleSnap.data()?.role as Role) : "student") ?? "student";

  if (role !== "tutor" && role !== "admin") throw new Error("Not permitted.");
  return { role };
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    await requireTutorOrAdmin(user.uid, user.email ?? null);

    const body: unknown = await req.json();
    const studentId = String((body as { studentId?: unknown })?.studentId ?? "").trim();
    if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured.");

    const studentRef = db.collection("students").doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const student = studentSnap.data() ?? {};
    const assignedTutorId = String((student as { assignedTutorId?: unknown }).assignedTutorId ?? "");

    if (assignedTutorId && assignedTutorId !== user.uid) {
      return NextResponse.json({ error: "Student already assigned to another tutor." }, { status: 403 });
    }

    const patch = {
      assignedTutorId: user.uid,
      assignedTutorEmail: user.email ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await studentRef.set(patch, { merge: true });

    // Also assign client (if present + unassigned or already assigned to this tutor)
    const clientId = String((student as { clientId?: unknown }).clientId ?? "");
    if (clientId) {
      const clientRef = db.collection("clients").doc(clientId);
      const clientSnap = await clientRef.get();

      if (clientSnap.exists) {
        const client = (clientSnap.data() ?? {}) as ClientDoc;
        const clientTutorId = String(client.assignedTutorId ?? "");
        if (shouldMirrorSingularTutor(clientTutorId, user.uid)) {
          await clientRef.set(patch, { merge: true });
        }

        // Multi-student-family correction (pre-Stage-6): recompute the full
        // set of tutors assigned to ANY student under this client (siblings
        // included), so the shared family record stays readable by every
        // currently-assigned tutor, not just whichever one claimed last.
        const siblingsSnap = await db.collection("students").where("clientId", "==", clientId).get();
        const siblingTutorIds = siblingsSnap.docs.map((d) =>
          d.id === studentId ? user.uid : (d.data() as { assignedTutorId?: string | null }).assignedTutorId ?? null
        );
        await clientRef.set(
          { assignedTutorIds: computeAssignedTutorIds(siblingTutorIds), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
