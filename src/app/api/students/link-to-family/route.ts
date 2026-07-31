import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isAdminEmail } from "@/lib/firebaseAdmin";
import { computeAssignedTutorIds, shouldMirrorSingularTutor } from "@/lib/studyroom/clientTutorSync";

// Admin-only, transactional "Link existing student" merge — the manual
// repair path for when a parent submitted separate enrolment forms for two
// children and Studyroom ended up with two client/family records (final
// pre-release addition, item 2).
//
// Every place clientId is stored or relied upon was traced before writing
// this (students, sessions, invoices, plans, leads — entitlements never
// stores clientId, only planId, so it needs no update). sessions/invoices/
// plans each store their OWN clientId as a snapshot taken at creation time —
// simply changing students/{studentId}.clientId would leave that history
// still pointing at the OLD family, which is exactly the "billing/session
// history attached to the old family" this route exists to avoid. Every
// affected document's clientId is updated together, in one transaction.
//
// Preserves: assigned tutor, activePlanId, plan/entitlement (entitlement is
// keyed by planId, never touched), session notes (subcollection, untouched —
// only the parent session doc's clientId moves), sessions, invoices,
// inquiry/enrolment history (the original lead's clientId is updated too, so
// it keeps pointing at wherever the student currently lives; the lead
// document itself — and its historical fields — are never deleted).
//
// If the old family has no students left after the move, it is archived
// (status: "ended", matching the existing "End family" mechanism) — never
// hard-deleted.

function readBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

// Safety cap: total documents written in one transaction (well under
// Firestore's hard 500-write transaction limit) — if a student genuinely has
// more historical records than this, refuse rather than risk a partial
// transaction failure, and surface a clear message instead.
const MAX_DOCS_IN_TRANSACTION = 400;

export async function POST(req: NextRequest) {
  const adminAuth = getAdminAuth();
  const db = getAdminDb();
  if (!adminAuth || !db) {
    return NextResponse.json({ error: "Admin SDK missing environment vars." }, { status: 500 });
  }

  try {
    const token = readBearerToken(req);
    if (!token) return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      studentId?: string;
      destinationClientId?: string;
    };
    const studentId = String(body.studentId ?? "").trim();
    const destinationClientId = String(body.destinationClientId ?? "").trim();
    if (!studentId || !destinationClientId) {
      return NextResponse.json({ error: "studentId and destinationClientId are required." }, { status: 400 });
    }

    const result = await db.runTransaction(async (tx) => {
      const studentRef = db.collection("students").doc(studentId);
      const destinationClientRef = db.collection("clients").doc(destinationClientId);

      const [studentSnap, destinationClientSnap] = await Promise.all([
        tx.get(studentRef),
        tx.get(destinationClientRef),
      ]);
      if (!studentSnap.exists) throw new Error("Student not found.");
      if (!destinationClientSnap.exists) throw new Error("Destination family not found.");

      const student = studentSnap.data() as {
        clientId?: string | null;
        studentName?: string;
        assignedTutorId?: string | null;
      };
      const oldClientId = String(student.clientId ?? "");
      if (!oldClientId) throw new Error("This student has no current family — nothing to move from.");
      if (oldClientId === destinationClientId) {
        throw new Error("This student is already in the destination family.");
      }

      const oldClientRef = db.collection("clients").doc(oldClientId);
      const oldClientSnap = await tx.get(oldClientRef);
      if (!oldClientSnap.exists) throw new Error("The student's current family record was not found.");

      const [sessionsSnap, invoicesSnap, plansSnap, leadsSnap, oldSiblingsSnap, destSiblingsSnap] = await Promise.all([
        tx.get(db.collection("sessions").where("studentId", "==", studentId)),
        tx.get(db.collection("invoices").where("studentId", "==", studentId)),
        tx.get(db.collection("plans").where("studentId", "==", studentId)),
        tx.get(db.collection("leads").where("studentId", "==", studentId)),
        tx.get(db.collection("students").where("clientId", "==", oldClientId)),
        tx.get(db.collection("students").where("clientId", "==", destinationClientId)),
      ]);

      const totalDocsToWrite =
        1 + // student
        sessionsSnap.size +
        invoicesSnap.size +
        plansSnap.size +
        leadsSnap.size +
        2; // old + destination client tutor-sync (archive counted separately below)
      if (totalDocsToWrite > MAX_DOCS_IN_TRANSACTION) {
        throw new Error(
          `This student has too many historical records (${totalDocsToWrite}) to move safely in one operation. Contact support for a manual migration.`
        );
      }

      // ── Writes ──────────────────────────────────────────────────────────────

      tx.update(studentRef, { clientId: destinationClientId, updatedAt: FieldValue.serverTimestamp() });

      for (const doc of sessionsSnap.docs) {
        tx.update(doc.ref, { clientId: destinationClientId, updatedAt: FieldValue.serverTimestamp() });
      }
      for (const doc of invoicesSnap.docs) {
        tx.update(doc.ref, { clientId: destinationClientId, updatedAt: FieldValue.serverTimestamp() });
      }
      for (const doc of plansSnap.docs) {
        tx.update(doc.ref, { clientId: destinationClientId, updatedAt: FieldValue.serverTimestamp() });
      }
      for (const doc of leadsSnap.docs) {
        tx.update(doc.ref, { clientId: destinationClientId, updatedAt: FieldValue.serverTimestamp() });
      }

      // ── Tutor-access sync (same mechanism as every other tutor-assignment
      // write in this app — see clientTutorSync.ts) ───────────────────────────

      const oldRemainingSiblingTutorIds = oldSiblingsSnap.docs
        .filter((d) => d.id !== studentId)
        .map((d) => (d.data() as { assignedTutorId?: string | null }).assignedTutorId);
      const oldAssignedTutorIds = computeAssignedTutorIds(oldRemainingSiblingTutorIds);

      const destExistingSiblingTutorIds = destSiblingsSnap.docs.map(
        (d) => (d.data() as { assignedTutorId?: string | null }).assignedTutorId
      );
      const destAssignedTutorIds = computeAssignedTutorIds([...destExistingSiblingTutorIds, student.assignedTutorId]);

      const destClientData = destinationClientSnap.data() as { assignedTutorId?: string | null };
      const destPatch: Record<string, unknown> = {
        assignedTutorIds: destAssignedTutorIds,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (shouldMirrorSingularTutor(destClientData.assignedTutorId, student.assignedTutorId)) {
        destPatch.assignedTutorId = student.assignedTutorId ?? null;
      }
      tx.update(destinationClientRef, destPatch);

      // Old family: if no students remain at all, archive it (never hard-
      // delete) — otherwise just resync its tutor-access array now that this
      // student's tutor may no longer belong.
      const oldRemainingStudentCount = oldSiblingsSnap.docs.filter((d) => d.id !== studentId).length;
      const oldFamilyArchived = oldRemainingStudentCount === 0;
      const oldPatch: Record<string, unknown> = {
        assignedTutorIds: oldAssignedTutorIds,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (oldFamilyArchived) {
        oldPatch.status = "ended";
        oldPatch.endedAt = FieldValue.serverTimestamp();
      }
      tx.update(oldClientRef, oldPatch);

      return {
        movedCounts: {
          sessions: sessionsSnap.size,
          invoices: invoicesSnap.size,
          plans: plansSnap.size,
          leads: leadsSnap.size,
        },
        oldFamilyArchived,
        studentName: String(student.studentName ?? "Student"),
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to link student to family";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
