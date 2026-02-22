import { Timestamp, type Firestore } from "firebase-admin/firestore";

export type AppRole = "tutor" | "admin";

export const SCHEDULING_RULES = {
  bufferMinutes: 10,
  allowedStartHour: 7,
  allowedEndHour: 20,
  maxDurationMinutes: 120,
  recurring: {
    includeWeek1: true,
    weeksAhead: 8,
  },
} as const;

type SessionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED_PARENT"
  | "CANCELLED_STUDYROOM"
  | "NO_SHOW";

export type SchedulingValidationResult =
  | { ok: true; warning?: true; conflictSessionId?: string }
  | {
      ok: false;
      status: number;
      error: string;
      code: "INVALID_TIME_RANGE" | "OUTSIDE_TUTORING_WINDOW" | "MAX_DURATION_EXCEEDED" | "SESSION_OVERLAP";
      conflictSessionId?: string;
    };

export function isCancelledStatus(status?: string) {
  return status === "CANCELLED_PARENT" || status === "CANCELLED_STUDYROOM";
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
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
  if (durationMinutes > SCHEDULING_RULES.maxDurationMinutes) {
    return {
      ok: false,
      status: 400,
      error: `Session cannot exceed ${SCHEDULING_RULES.maxDurationMinutes} minutes.`,
      code: "MAX_DURATION_EXCEEDED",
    };
  }

  // Business rule: all tutoring must stay within 07:00-20:00 local time.
  const startMin = minutesSinceMidnight(start);
  const endMin = minutesSinceMidnight(end);
  const minAllowed = SCHEDULING_RULES.allowedStartHour * 60;
  const maxAllowed = SCHEDULING_RULES.allowedEndHour * 60;
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (!sameDay || startMin < minAllowed || endMin > maxAllowed) {
    return {
      ok: false,
      status: 400,
      error: `Sessions must be between 07:00 and 20:00.`,
      code: "OUTSIDE_TUTORING_WINDOW",
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
  const bufferMs = SCHEDULING_RULES.bufferMinutes * 60 * 1000;
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
