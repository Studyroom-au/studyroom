// ─── QLD Australian Curriculum / ACiQ (Prep–Year 10) ─────────────────────────
//
// P-10 subjects are intentionally broad. The year level provides the specificity.
// "Year 3 Mathematics" is distinct from "Year 9 Mathematics" via the year field.

export const QLD_ACIQ_SUBJECTS = [
  "Mathematics",
  "English",
  "Science",
  "HASS",
  "Health & PE",
] as const;

export type QldAciqSubject = (typeof QLD_ACIQ_SUBJECTS)[number];

export const YEAR_LEVELS_ACIQ = [
  "Prep",
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
] as const;

export type AciqYearLevel = (typeof YEAR_LEVELS_ACIQ)[number];

// ─── QLD QCAA Senior Subjects (Year 11–12) ────────────────────────────────────
//
// At senior level, the subject name IS the specificity.
// "Mathematics" is meaningless — use the full QCAA subject name.
// A tutor who can teach Mathematical Methods is not automatically suitable
// for Specialist Mathematics.

export const QLD_QCAA_SUBJECTS_MATHEMATICS = [
  "General Mathematics",
  "Mathematical Methods",
  "Specialist Mathematics",
  "Essential Mathematics",
] as const;

export const QLD_QCAA_SUBJECTS_ENGLISH = [
  "English",
  "Essential English",
  "Literature",
] as const;

export const QLD_QCAA_SUBJECTS_SCIENCES = [
  "Biology",
  "Chemistry",
  "Physics",
] as const;

// Flat list used for validation. Grouped exports above are for UI display.
export const QLD_QCAA_SUBJECTS_FLAT = [
  ...QLD_QCAA_SUBJECTS_MATHEMATICS,
  ...QLD_QCAA_SUBJECTS_ENGLISH,
  ...QLD_QCAA_SUBJECTS_SCIENCES,
] as const;

export type QldQcaaSubject = (typeof QLD_QCAA_SUBJECTS_FLAT)[number];

export const YEAR_LEVELS_QCAA = ["Year 11", "Year 12"] as const;

export type QcaaYearLevel = (typeof YEAR_LEVELS_QCAA)[number];

// ─── Deferred QCAA subjects (Phase 3+, lower demand) ─────────────────────────
//
// Not in MVP. Add to QLD_QCAA_SUBJECTS_* arrays when demand warrants.
//
// English Communication, Earth & Environmental Science, Psychology,
// Legal Studies, Economics, Geography, Ancient History, Modern History,
// Digital Solutions, Accounting, Business

// ─── Combined subject and year level lists ────────────────────────────────────

export const ALL_TUTOR_SUBJECTS = [
  ...QLD_ACIQ_SUBJECTS,
  ...QLD_QCAA_SUBJECTS_FLAT,
] as const;

export type TutorSubject = (typeof ALL_TUTOR_SUBJECTS)[number];

export const ALL_YEAR_LEVELS = [
  ...YEAR_LEVELS_ACIQ,
  ...YEAR_LEVELS_QCAA,
] as const;

export type TutorYearLevel = (typeof ALL_YEAR_LEVELS)[number];

// ─── Subject/year cross-validation ───────────────────────────────────────────
//
// ACiQ subjects (P-10) only pair with Prep–Year 10.
// QCAA subjects (senior) only pair with Year 11–12.
// Used by the future /api/tutors/profile route to validate capability entries.
//
// NSW/NESA: when added, extend this function to handle NSW subjects and years.
// The current schema does not store jurisdiction in the capability object,
// so NSW subjects must have distinct names or a jurisdiction field must be added.

export function isValidSubjectYearCombination(
  subject: string,
  year: string
): boolean {
  const isAciqSubject = (QLD_ACIQ_SUBJECTS as readonly string[]).includes(subject);
  const isQcaaSubject = (QLD_QCAA_SUBJECTS_FLAT as readonly string[]).includes(subject);
  const isAciqYear = (YEAR_LEVELS_ACIQ as readonly string[]).includes(year);
  const isQcaaYear = (YEAR_LEVELS_QCAA as readonly string[]).includes(year);

  if (isAciqSubject) return isAciqYear;
  if (isQcaaSubject) return isQcaaYear;
  return false;
}

// ─── Support capabilities (GENERAL_SUPPORT) ───────────────────────────────────
//
// Separate from academic subjects. No year level — apply across year levels.
// Tutor-entered with readiness ("independent" | "with_support").
//
// Deferred: Executive Functioning Support, Gifted & Extension, ESL/EAL/D,
// Confidence Building (too vague for operational matching).

export const SUPPORT_CAPABILITIES = [
  "Early Literacy",
  "Foundational Numeracy",
  "Study Skills & Organisation",
  "Exam Preparation",
  "NAPLAN Preparation",
  "Assignment Management",
  "Homework Support",
  "ADHD Support",
  "Autism/ASD Support",
  "Anxiety Support",
  "Dyslexia Support",
  "Learning Difficulties (General)",
] as const;

export type SupportCapabilityType = (typeof SUPPORT_CAPABILITIES)[number];

// ─── Readiness values ─────────────────────────────────────────────────────────
//
// Operational language only — no confidence percentages, star ratings, or
// vague labels like "high/medium/low confidence".
//
// "independent"  = safe to match now; no preparation or admin support needed.
// "with_support" = can teach this combination, but may benefit from extra
//                  preparation, resources, or mentoring before or during.
//
// A missing capability entry means "not offered" — never "not ready".
// Tutors are never asked to list what they cannot teach.

export const TUTOR_READINESS_VALUES = [
  "independent",
  "with_support",
] as const;

export type TutorReadiness = (typeof TUTOR_READINESS_VALUES)[number];

// ─── Capability advisory statuses (admin-only) ────────────────────────────────
//
// Admin places these on top of tutor-declared capabilities.
// Stored in tutors/{uid}/internal/admin.capabilityAdvisories[].
// Tutor cannot see or modify advisories.

export const CAPABILITY_ADVISORY_STATUSES = [
  "admin_review",    // admin wants to check before any match is made
  "mentor_first",    // tutor needs prep/mentoring before this match
  "do_not_match",    // admin explicitly blocks this combination
  "not_yet_assessed", // admin has not yet evaluated this combination
] as const;

export type CapabilityAdvisoryStatus =
  (typeof CAPABILITY_ADVISORY_STATUSES)[number];

// ─── Tutor modes ──────────────────────────────────────────────────────────────

export const TUTOR_MODES = ["online", "in_home", "group"] as const;

export type TutorMode = (typeof TUTOR_MODES)[number];

// ─── Availability days ────────────────────────────────────────────────────────

export const AVAILABILITY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type AvailabilityDay = (typeof AVAILABILITY_DAYS)[number];

// ─── Availability time blocks ─────────────────────────────────────────────────
//
// Used as rows in the availability grid on the tutor profile form.
// Combined with AVAILABILITY_DAYS columns to produce AvailabilitySlot records.
// The future matching query is: "Can this tutor take a student on Tuesday 3:30–5pm?"
// Overlapping blocks (3:00–4:30 and 4:30–6:00) both match that range.

export const AVAILABILITY_BLOCKS = [
  "Before school",
  "School hours",
  "3:00–4:30 pm",
  "4:30–6:00 pm",
  "6:00–8:00 pm",
  "Weekend morning",
  "Weekend afternoon",
] as const;

export type AvailabilityBlock = (typeof AVAILABILITY_BLOCKS)[number];

// ─── Profile status values ────────────────────────────────────────────────────
//
// Visible to the tutor via their own tutors/{uid} document read.
// "draft"          Created but required fields not yet submitted.
// "pending_review" Tutor has submitted all required fields; awaiting admin.
// "active"         Admin has reviewed and approved.
// "paused"         Temporarily unavailable. Admin-owned in V2.

export const PROFILE_STATUS_VALUES = [
  "draft",
  "pending_review",
  "active",
  "paused",
] as const;

export type TutorProfileStatus = (typeof PROFILE_STATUS_VALUES)[number];

// ─── Onboarding stage values (admin-only) ─────────────────────────────────────

export const ONBOARDING_STAGE_VALUES = [
  "pending",
  "active",
  "probation",
  "paused",
  "offboarded",
] as const;

export type TutorOnboardingStage = (typeof ONBOARDING_STAGE_VALUES)[number];

// ─── Capacity status values (admin-only) ──────────────────────────────────────
//
// Maintained manually by admin in tutors/{uid}/internal/admin.
// Future Phase 6 will derive this from the sessions collection automatically.

export const CAPACITY_STATUS_VALUES = [
  "has_capacity",
  "near_capacity",
  "at_capacity",
  "paused",
] as const;

export type TutorCapacityStatus = (typeof CAPACITY_STATUS_VALUES)[number];

// Number of days after which approxCurrentHoursPerWeek / capacityStatus
// should be flagged as stale in the admin UI.
export const CAPACITY_STALENESS_DAYS = 14;

// ─── Profile required fields ──────────────────────────────────────────────────
//
// When ALL of these are present and non-empty, the future /api/tutors/profile
// route transitions profileStatus from "draft" to "pending_review" and sets
// onboardingCompletedAt if not already set.

export const TUTOR_PROFILE_REQUIRED_FIELDS = [
  "phone",
  "abn",
  "wwccNumber",
  "availabilityDays",
  "modes",
  "capabilities",
] as const;

export type TutorProfileRequiredField =
  (typeof TUTOR_PROFILE_REQUIRED_FIELDS)[number];

// ─── Tutor-editable fields allowlist ─────────────────────────────────────────
//
// The future POST /api/tutors/profile route enforces this as the exact allowlist.
// Any field in the request body NOT in this list → 400 error (not silently stripped).
// Any field in TUTOR_PROFILE_PROTECTED_FIELDS in the request body → 400 error.
//
// The route accepts requests from:
//   role === "tutor"         (approved tutors updating their profile)
//   role === "tutor_pending" (pending tutors completing profile before approval)

export const TUTOR_PROFILE_EDITABLE_FIELDS = [
  "phone",
  "bio",
  "capabilities",
  "supportCapabilities",
  "modes",
  "suburb",
  "postcode",
  "serviceSuburbs",
  "travelNotes",
  "availabilityDays",
  "availabilitySlots",
  "availabilityNote",
  "maxTravelMinutes",
  "maxTravelKm",
  "maxActiveStudents",
  "desiredHoursPerWeek",
  "maxHoursPerWeek",
  "abn",
  "wwccNumber",
  "wwccState",
  "wwccExpiresAt",
  "blueCardNumber",
  "blueCardExpiresAt",
] as const;

export type TutorProfileEditableField =
  (typeof TUTOR_PROFILE_EDITABLE_FIELDS)[number];

// ─── Protected fields (cause a 400 error if included in tutor payload) ────────
//
// These fields are set by the system or admin only.
// The future API route explicitly rejects requests that include these fields
// rather than silently stripping them, to make frontend mistakes visible.

export const TUTOR_PROFILE_PROTECTED_FIELDS = [
  "profileStatus",
  "onboardingCompletedAt",
  "createdAt",
  "updatedAt",
] as const;

export type TutorProfileProtectedField =
  (typeof TUTOR_PROFILE_PROTECTED_FIELDS)[number];
