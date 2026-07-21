//src/lib/scheduling/validate.ts
import { Timestamp, type Firestore } from "firebase-admin/firestore";

export type AppRole = "tutor" | "admin";

// Release 1A, Stage 3: the only standard billable unit is 60 minutes. The old
// 07:00-20:00 window and 120-minute cap were never enforced anywhere in the
// app (this module had zero importers) and are replaced outright rather than
// merged with, since a two-hour lesson is now booked as two independent
// 60-minute sessions instead of one long one.
export const STANDARD_SESSION_DURATION_MINUTES = 60;
export const OVERLAP_BUFFER_MINUTES = 10;

type SessionStatus =
  | "scheduled"
  | "completed"
  | "cancelled_by_parent"
  | "cancelled_by_tutor"
  | "no_show";

export type SchedulingValidationResult =
  | { ok: true; warning?: true; conflictSessionId?: string }
  | {
      ok: false;
      status: number;
      error: string;
      code: "INVALID_TIME_RANGE" | "INVALID_DURATION" | "SESSION_OVERLAP";
      conflictSessionId?: string;
    };

export function isCancelledStatus(status?: string) {
  const s = (status || "").toLowerCase();
  return s === "cancelled_by_parent" || s === "cancelled_by_tutor";
}

/** Pure, dependency-free check — the only thing that changed for this session. */
export function isStandardDuration(durationMinutes: number): boolean {
  return durationMinutes === STANDARD_SESSION_DURATION_MINUTES;
}

export function validateStaticSchedulingRules(start: Date, end: Date): SchedulingValidationResult {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      ok: false,
      status: 400,
      error: "Invalid time range.",
      code: "INVALID_TIME_RANGE",
    };
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (!isStandardDuration(durationMinutes)) {
    return {
      ok: false,
      status: 400,
      error: `Sessions must be exactly ${STANDARD_SESSION_DURATION_MINUTES} minutes.`,
      code: "INVALID_DURATION",
    };
  }

  return { ok: true };
}

async function findConflictSessionId(params: {
  db: Firestore;
  tutorId: string;
  start: Date;
  end: Date;
  excludeSessionId?: string;
}) {
  const { db, tutorId, start, end, excludeSessionId } = params;

  // Business rule: enforce a 10-minute turnaround buffer before and after each session.
  const bufferMs = OVERLAP_BUFFER_MINUTES * 60 * 1000;
  const queryStart = new Date(start.getTime() - bufferMs);
  const queryEnd = new Date(end.getTime() + bufferMs);

  const snap = await db
    .collection("sessions")
    .where("tutorId", "==", tutorId)
    .where("startAt", "<", Timestamp.fromDate(queryEnd))
    .where("endAt", ">", Timestamp.fromDate(queryStart))
    .get();

  const conflict = snap.docs.find((d) => {
    if (excludeSessionId && d.id === excludeSessionId) return false;
    const data = d.data() as { status?: SessionStatus };
    return !isCancelledStatus(data.status);
  });

  return conflict?.id ?? null;
}

export async function validateSchedulingRules(params: {
  db: Firestore;
  tutorId: string;
  start: Date;
  end: Date;
  role: AppRole;
  excludeSessionId?: string;
}): Promise<SchedulingValidationResult> {
  const staticValidation = validateStaticSchedulingRules(params.start, params.end);
  if (!staticValidation.ok) return staticValidation;

  const conflictSessionId = await findConflictSessionId(params);
  if (!conflictSessionId) return { ok: true };

  if (params.role === "admin") {
    // Admin can proceed through overlaps, but caller should surface a warning.
    return { ok: true, warning: true, conflictSessionId };
  }

  return {
    ok: false,
    status: 409,
    error: "Overlap detected.",
    code: "SESSION_OVERLAP",
    conflictSessionId,
  };
}
