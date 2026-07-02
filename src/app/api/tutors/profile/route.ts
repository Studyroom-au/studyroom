import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { verifyIdTokenFromRequest, getAdminDb } from "@/lib/firebaseAdmin";
import {
  TUTOR_PROFILE_EDITABLE_FIELDS,
  TUTOR_PROFILE_PROTECTED_FIELDS,
  TUTOR_PROFILE_REQUIRED_FIELDS,
  ALL_TUTOR_SUBJECTS,
  ALL_YEAR_LEVELS,
  SUPPORT_CAPABILITIES,
  TUTOR_READINESS_VALUES,
  TUTOR_MODES,
  AVAILABILITY_DAYS,
  AVAILABILITY_BLOCKS,
  isValidSubjectYearCombination,
} from "@/lib/studyroom/tutorConstants";

const ADMIN_EMAIL = "lily.studyroom@gmail.com";
const ALLOWED_ROLES = new Set(["tutor", "tutor_pending"]);

async function authenticate(req: NextRequest): Promise<{ uid: string; email: string }> {
  const decoded = await verifyIdTokenFromRequest(req);
  return { uid: decoded.uid, email: (decoded.email ?? "").toLowerCase().trim() };
}

async function authorise(uid: string, email: string): Promise<boolean> {
  if (email === ADMIN_EMAIL) return true;
  const db = getAdminDb();
  const snap = await db.collection("roles").doc(uid).get();
  const role = String(snap.data()?.role ?? "");
  return ALLOWED_ROLES.has(role);
}

// Recursively convert Firestore Timestamps to ISO strings for JSON serialisation.
function serialise(val: unknown): unknown {
  if (val && typeof val === "object") {
    if ("toDate" in val && typeof (val as { toDate: unknown }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    if (Array.isArray(val)) {
      return val.map(serialise);
    }
    const obj = val as Record<string, unknown>;
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialise(v)]));
  }
  return val;
}

// ─── GET /api/tutors/profile ────────────────────────────────────────────────
// Returns the calling tutor's tutors/{uid} profile document (or null).
// Uses Admin SDK so Firestore client rules do not affect this read.

export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await authenticate(req);
    if (!(await authorise(uid, email))) {
      return NextResponse.json({ error: "Forbidden — tutor or tutor_pending role required." }, { status: 403 });
    }

    const db = getAdminDb();
    const snap = await db.collection("tutors").doc(uid).get();
    if (!snap.exists) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({ profile: serialise(snap.data() ?? {}) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    if (msg.includes("Missing Authorization") || msg.includes("auth/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    console.error("[GET /api/tutors/profile]", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}

// ─── POST /api/tutors/profile ────────────────────────────────────────────────
// Validates and saves tutor-editable fields to tutors/{uid}.
// Protected and unknown fields are rejected with 400.
// Sets profileStatus lifecycle automatically.
// Does NOT write to tutors/{uid}/internal/admin.

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await authenticate(req);
    if (!(await authorise(uid, email))) {
      return NextResponse.json({ error: "Forbidden — tutor or tutor_pending role required." }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // ── Field allowlist validation ────────────────────────────────────────────
    const editableSet = new Set<string>(TUTOR_PROFILE_EDITABLE_FIELDS);
    const protectedSet = new Set<string>(TUTOR_PROFILE_PROTECTED_FIELDS);

    for (const key of Object.keys(body)) {
      if (protectedSet.has(key)) {
        return NextResponse.json(
          { error: `Field "${key}" is protected and cannot be set by tutors.` },
          { status: 400 }
        );
      }
      if (!editableSet.has(key)) {
        return NextResponse.json(
          { error: `Unknown field "${key}". Only tutor-editable fields are accepted.` },
          { status: 400 }
        );
      }
    }

    // ── Value validation ──────────────────────────────────────────────────────
    const errors: string[] = [];

    if ("capabilities" in body) {
      if (!Array.isArray(body.capabilities)) {
        errors.push("capabilities must be an array.");
      } else {
        (body.capabilities as unknown[]).forEach((cap, i) => {
          if (typeof cap !== "object" || cap === null) {
            errors.push(`capabilities[${i}] must be an object.`);
            return;
          }
          const c = cap as Record<string, unknown>;
          if (
            typeof c.subject !== "string" ||
            !(ALL_TUTOR_SUBJECTS as readonly string[]).includes(c.subject)
          ) {
            errors.push(`capabilities[${i}].subject "${c.subject}" is not a valid subject.`);
          }
          if (!Array.isArray(c.years) || (c.years as unknown[]).length === 0) {
            errors.push(`capabilities[${i}].years must be a non-empty array.`);
          } else {
            (c.years as unknown[]).forEach((year, j) => {
              if (
                typeof year !== "string" ||
                !(ALL_YEAR_LEVELS as readonly string[]).includes(year)
              ) {
                errors.push(`capabilities[${i}].years[${j}] "${year}" is not a valid year level.`);
              } else if (
                typeof c.subject === "string" &&
                !isValidSubjectYearCombination(c.subject, year)
              ) {
                errors.push(
                  `capabilities[${i}]: "${year}" is not valid for subject "${c.subject}".`
                );
              }
            });
          }
          if (
            typeof c.readiness !== "string" ||
            !(TUTOR_READINESS_VALUES as readonly string[]).includes(c.readiness)
          ) {
            errors.push(
              `capabilities[${i}].readiness must be "independent" or "with_support".`
            );
          }
        });
      }
    }

    if ("supportCapabilities" in body) {
      if (!Array.isArray(body.supportCapabilities)) {
        errors.push("supportCapabilities must be an array.");
      } else {
        (body.supportCapabilities as unknown[]).forEach((cap, i) => {
          if (typeof cap !== "object" || cap === null) {
            errors.push(`supportCapabilities[${i}] must be an object.`);
            return;
          }
          const c = cap as Record<string, unknown>;
          if (
            typeof c.type !== "string" ||
            !(SUPPORT_CAPABILITIES as readonly string[]).includes(c.type)
          ) {
            errors.push(
              `supportCapabilities[${i}].type "${c.type}" is not a valid support capability.`
            );
          }
          if (
            typeof c.readiness !== "string" ||
            !(TUTOR_READINESS_VALUES as readonly string[]).includes(c.readiness)
          ) {
            errors.push(
              `supportCapabilities[${i}].readiness must be "independent" or "with_support".`
            );
          }
        });
      }
    }

    if ("modes" in body) {
      if (!Array.isArray(body.modes)) {
        errors.push("modes must be an array.");
      } else {
        (body.modes as unknown[]).forEach((m, i) => {
          if (
            typeof m !== "string" ||
            !(TUTOR_MODES as readonly string[]).includes(m)
          ) {
            errors.push(`modes[${i}] "${m}" must be one of: ${TUTOR_MODES.join(", ")}.`);
          }
        });
      }
    }

    if ("availabilityDays" in body) {
      if (!Array.isArray(body.availabilityDays)) {
        errors.push("availabilityDays must be an array.");
      } else {
        (body.availabilityDays as unknown[]).forEach((d, i) => {
          if (
            typeof d !== "string" ||
            !(AVAILABILITY_DAYS as readonly string[]).includes(d)
          ) {
            errors.push(`availabilityDays[${i}] "${d}" is not a valid day of the week.`);
          }
        });
      }
    }

    const stringFields = [
      "phone", "bio", "suburb", "postcode", "travelNotes",
      "availabilityNote", "wwccNumber", "wwccState", "abn",
    ] as const;
    for (const f of stringFields) {
      if (f in body && typeof body[f] !== "string") {
        errors.push(`${f} must be a string.`);
      }
    }

    if ("serviceSuburbs" in body && !Array.isArray(body.serviceSuburbs)) {
      errors.push("serviceSuburbs must be an array of strings.");
    }

    if (
      "blueCardNumber" in body &&
      body.blueCardNumber !== null &&
      typeof body.blueCardNumber !== "string"
    ) {
      errors.push("blueCardNumber must be a string or null.");
    }

    for (const f of ["desiredHoursPerWeek", "maxHoursPerWeek", "maxTravelMinutes", "maxTravelKm", "maxActiveStudents"] as const) {
      if (f in body) {
        const v = body[f];
        if (typeof v !== "number" || v < 0 || !isFinite(v)) {
          errors.push(`${f} must be a non-negative number.`);
        }
      }
    }

    if ("availabilitySlots" in body) {
      if (!Array.isArray(body.availabilitySlots)) {
        errors.push("availabilitySlots must be an array.");
      } else {
        (body.availabilitySlots as unknown[]).forEach((slot, i) => {
          if (typeof slot !== "object" || slot === null) {
            errors.push(`availabilitySlots[${i}] must be an object.`);
            return;
          }
          const s = slot as Record<string, unknown>;
          if (typeof s.day !== "string" || !(AVAILABILITY_DAYS as readonly string[]).includes(s.day)) {
            errors.push(`availabilitySlots[${i}].day "${s.day}" is not a valid day.`);
          }
          if (typeof s.block !== "string" || !(AVAILABILITY_BLOCKS as readonly string[]).includes(s.block)) {
            errors.push(`availabilitySlots[${i}].block "${s.block}" is not a valid time block.`);
          }
        });
      }
    }

    for (const f of ["wwccExpiresAt", "blueCardExpiresAt"] as const) {
      if (f in body && body[f] !== null && typeof body[f] !== "string") {
        errors.push(`${f} must be a date string (YYYY-MM-DD) or null.`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed.", details: errors }, { status: 400 });
    }

    // ── Build Firestore patch ─────────────────────────────────────────────────
    const patch: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(body)) {
      if ((key === "wwccExpiresAt" || key === "blueCardExpiresAt") && typeof val === "string" && val) {
        const d = new Date(val);
        patch[key] = isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
      } else {
        patch[key] = val;
      }
    }
    patch.updatedAt = FieldValue.serverTimestamp();

    // ── Load existing profile ─────────────────────────────────────────────────
    const db = getAdminDb();
    const profileRef = db.collection("tutors").doc(uid);
    const profileSnap = await profileRef.get();
    const existing = profileSnap.exists ? (profileSnap.data() ?? {}) : {};

    if (!profileSnap.exists) {
      patch.profileStatus = "draft";
      patch.createdAt = FieldValue.serverTimestamp();
      patch.onboardingCompletedAt = null;
    }

    // ── Profile completion check ──────────────────────────────────────────────
    const merged: Record<string, unknown> = { ...existing, ...patch };
    const allRequiredPresent = TUTOR_PROFILE_REQUIRED_FIELDS.every((field) => {
      const v = merged[field];
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "string") return v.trim().length > 0;
      return v != null;
    });

    if (allRequiredPresent) {
      const currentStatus = String(existing.profileStatus ?? "draft");
      if (currentStatus === "draft" || !existing.profileStatus) {
        patch.profileStatus = "pending_review";
      }
      if (!existing.onboardingCompletedAt && !patch.onboardingCompletedAt) {
        patch.onboardingCompletedAt = FieldValue.serverTimestamp();
      }
    }

    await profileRef.set(patch, { merge: true });

    const finalStatus = String(patch.profileStatus ?? existing.profileStatus ?? "draft");
    return NextResponse.json({ ok: true, profileStatus: finalStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    if (msg.includes("Missing Authorization") || msg.includes("auth/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    console.error("[POST /api/tutors/profile]", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
