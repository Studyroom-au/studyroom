// ─── Shared timestamp type ────────────────────────────────────────────────────
//
// Both firebase/firestore FirestoreTimestamp (client SDK) and firebase-admin/firestore
// FirestoreTimestamp (Admin SDK) satisfy this structural interface. Using it here keeps
// this types file importable by both client components and server-side API routes
// without triggering cross-SDK TypeScript errors.

export type FirestoreTimestamp = {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
};

// ─── Primitive union types ─────────────────────────────────────────────────────

/**
 * Operational readiness for a tutor capability.
 * "independent"  = ready to teach this combination now, no preparation needed.
 * "with_support" = can teach with preparation, resources, or mentoring input.
 * A missing capability entry means "not offered" — tutors never declare what
 * they cannot do; they only list what they can.
 */
export type TutorReadiness = "independent" | "with_support";

export type TutorMode = "online" | "in_home" | "group";

/**
 * Profile lifecycle status — visible to the tutor.
 * "draft"          Set by system when the shell profile document is created.
 * "pending_review" Set by the API route when tutor submits all required fields.
 * "active"         Set by admin after review and compliance verification.
 * "paused"         Admin-owned in V2 (tutor temporarily unavailable).
 */
export type TutorProfileStatus = "draft" | "pending_review" | "active" | "paused";

/**
 * Internal operational stage — admin-only, stored in tutors/{uid}/internal/admin.
 */
export type TutorOnboardingStage =
  | "pending"
  | "active"
  | "probation"
  | "paused"
  | "offboarded";

/**
 * Admin-maintained capacity signal — stored in tutors/{uid}/internal/admin.
 * Updated manually by admin from the session schedule.
 * approxUpdatedAt must be surfaced in the admin UI; flag staleness after 14 days.
 */
export type TutorCapacityStatus =
  | "has_capacity"
  | "near_capacity"
  | "at_capacity"
  | "paused";

/**
 * Status values for admin capability advisories.
 * Advisories annotate (not replace) tutor-declared capabilities.
 */
export type CapabilityAdvisoryStatus =
  | "admin_review"
  | "mentor_first"
  | "do_not_match"
  | "not_yet_assessed";

// ─── Availability slot ────────────────────────────────────────────────────────
//
// One checked cell in the availability grid.
// day must be a value from AVAILABILITY_DAYS in tutorConstants.ts.
// block must be a value from AVAILABILITY_BLOCKS in tutorConstants.ts.
// The array is the complete set of available slots the tutor declares.

export type AvailabilitySlot = {
  day: string;
  block: string;
};

// ─── Capability objects ────────────────────────────────────────────────────────

/**
 * One academic teaching capability entry on the tutor's profile.
 *
 * subject must be a value from ALL_TUTOR_SUBJECTS in tutorConstants.ts.
 * years must be values from ALL_YEAR_LEVELS in tutorConstants.ts.
 * Subject/year combinations are cross-validated by isValidSubjectYearCombination().
 *
 * QLD_ACIQ subjects (Mathematics, English, Science, HASS, Health & PE) pair with
 * Prep–Year 10 only. QLD_QCAA subjects (e.g. Mathematical Methods, Biology) pair
 * with Year 11–12 only. The API route enforces this constraint.
 */
export type TutorCapability = {
  subject: string;
  years: string[];
  readiness: TutorReadiness;
};

/**
 * One support/pastoral capability entry.
 * type must be a value from SUPPORT_CAPABILITIES in tutorConstants.ts.
 * No year level — support capabilities apply across year levels.
 */
export type TutorSupportCapability = {
  type: string;
  readiness: TutorReadiness;
};

/**
 * Admin advisory placed on top of a tutor's self-reported academic capability.
 * Stored in tutors/{uid}/internal/admin.capabilityAdvisories[].
 *
 * This does NOT replace the tutor's capability entry — it annotates it for
 * internal operational use only. The tutor cannot see or modify advisories.
 *
 * years: [] means the advisory applies to all year levels for this subject.
 */
export type CapabilityAdvisory = {
  subject: string;
  years: string[];
  status: CapabilityAdvisoryStatus;
  note: string;
  setBy: string;
  setAt: FirestoreTimestamp;
};

// ─── Main tutor profile document: tutors/{uid} ────────────────────────────────
//
// Security model:
//   Tutor: read own document directly from Firestore.
//   Tutor: write ONLY through POST /api/tutors/profile (validated API route).
//   Admin: read/write via Admin SDK or admin API routes.
//
// The Firestore rule for tutors/{uid} is:
//   allow read:  if isSelf(uid) || isAdmin();
//   allow write: if isAdmin();   ← tutors never write directly
//
// profileStatus, onboardingCompletedAt, createdAt, updatedAt are PROTECTED.
// The future API route rejects any request body that includes these fields
// with a 400 error. Unknown fields are also rejected (not silently stripped).

export type TutorProfile = {
  // ── Identity ─────────────────────────────────────────────────────────────────
  // name and email stay in users/{uid} — Firebase Auth drives those.
  phone: string;
  bio: string;

  // ── Teaching capabilities ──────────────────────────────────────────────────
  capabilities: TutorCapability[];
  supportCapabilities: TutorSupportCapability[];

  // ── Modality ─────────────────────────────────────────────────────────────────
  modes: TutorMode[];

  // ── Location ──────────────────────────────────────────────────────────────────
  suburb: string;
  postcode: string;
  serviceSuburbs: string[];
  travelNotes: string;
  maxTravelMinutes: number;
  maxTravelKm: number;

  // ── Availability ──────────────────────────────────────────────────────────────
  // availabilityDays: legacy day-level field — derived from availabilitySlots on save.
  // availabilitySlots: structured grid — day × block pairs the tutor marks as available.
  // availabilityNote: free-text context kept for backwards compatibility.
  availabilityDays: string[];
  availabilitySlots: AvailabilitySlot[];
  availabilityNote: string;

  // ── Capacity (tutor-declared) ─────────────────────────────────────────────────
  desiredHoursPerWeek: number;
  maxHoursPerWeek: number;
  // maxActiveStudents: advisory ceiling on concurrent active students.
  // activeStudentCount and remainingStudentSlots are always derived — never stored.
  maxActiveStudents: number;

  // ── Compliance — tutor-submitted ──────────────────────────────────────────────
  // Admin verifies these separately in tutors/{uid}/internal/admin.
  // A tutor cannot mark themselves as verified.
  abn: string;
  wwccNumber: string;
  wwccState: string;
  wwccExpiresAt: FirestoreTimestamp | null;
  blueCardNumber: string | null;
  blueCardExpiresAt: FirestoreTimestamp | null;

  // ── Profile lifecycle (PROTECTED — not directly writable by tutor) ─────────────
  profileStatus: TutorProfileStatus;

  // ── Metadata (PROTECTED — set by system/API only) ────────────────────────────
  onboardingCompletedAt: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

// ─── Tutor-editable payload — contract for future /api/tutors/profile ─────────
//
// This Pick is the exact allowlist the future API route enforces.
//
// Route behaviour:
//   1. Accepts requests from role === "tutor" OR role === "tutor_pending".
//      Both pending and approved tutors must be able to complete or update
//      their profile. Pending tutors submit before approval; approved tutors
//      update later as availability, subjects, or capacity changes.
//   2. Rejects any field NOT in this type with a 400 error (not a silent strip).
//   3. Rejects any field in TUTOR_PROFILE_PROTECTED_FIELDS with a 400 error.
//   4. Appends updatedAt: serverFirestoreTimestamp() server-side.
//   5. Derives profileStatus transition (draft → pending_review) server-side
//      when all TUTOR_PROFILE_REQUIRED_FIELDS are present.
//
// Admin-owned fields (profileStatus, readyForMatching, onboardingStage, etc.)
// are never accepted in this payload.

export type TutorProfileUpdatePayload = Pick<
  TutorProfile,
  | "phone"
  | "bio"
  | "capabilities"
  | "supportCapabilities"
  | "modes"
  | "suburb"
  | "postcode"
  | "serviceSuburbs"
  | "travelNotes"
  | "maxTravelMinutes"
  | "maxTravelKm"
  | "availabilityDays"
  | "availabilitySlots"
  | "availabilityNote"
  | "desiredHoursPerWeek"
  | "maxHoursPerWeek"
  | "maxActiveStudents"
  | "abn"
  | "wwccNumber"
  | "wwccState"
  | "wwccExpiresAt"
  | "blueCardNumber"
  | "blueCardExpiresAt"
>;

// ─── Admin-only internal document: tutors/{uid}/internal/admin ────────────────
//
// Security model:
//   Tutor: NO access (read or write). Firestore rule denies entirely.
//   Admin: read/write via Admin SDK or admin API routes only.
//
// Document path: tutors/{tutorUid}/internal/admin
// Document ID is always "admin" — one fixed document per tutor.

export type TutorInternalAdmin = {
  // ── Compliance verification ────────────────────────────────────────────────
  // Admin sets these after physically checking the tutor's documents.
  wwccVerified: boolean;
  wwccVerifiedAt: FirestoreTimestamp | null;
  blueCardVerified: boolean;
  blueCardVerifiedAt: FirestoreTimestamp | null;
  complianceNotes: string;

  // ── Matching gate ──────────────────────────────────────────────────────────
  // readyForMatching is ADMIN-ONLY and must be explicitly set to true.
  // A tutor is NEVER auto-promoted to matchable.
  // Minimum requirements before admin sets readyForMatching = true:
  //   - tutors/{uid}.profileStatus === "active"
  //   - wwccVerified === true
  //   - admin has reviewed the profile
  readyForMatching: boolean;
  onboardingStage: TutorOnboardingStage;
  approvedAt: FirestoreTimestamp | null;
  approvedBy: string | null;

  // ── Capacity — admin view ─────────────────────────────────────────────────
  // approxCurrentHoursPerWeek is admin-estimated from the current session schedule.
  // approxUpdatedAt must be shown in the admin UI to surface staleness.
  // Flag visually if approxUpdatedAt is older than CAPACITY_STALENESS_DAYS (14 days).
  // maxHoursOverride takes precedence over tutors/{uid}.maxHoursPerWeek when set.
  //
  // Future (Phase 6 — system-derived, not built now):
  //   currentAssignedHoursPerWeek — computed from sessions collection
  //   capacityRemainingHours      — computed: max - current
  approxCurrentHoursPerWeek: number;
  capacityStatus: TutorCapacityStatus;
  approxUpdatedAt: FirestoreTimestamp | null;
  maxHoursOverride: number | null;

  // ── Capability advisories ─────────────────────────────────────────────────
  // Admin annotations on top of tutor-declared capabilities.
  // Tutor cannot see or modify these.
  capabilityAdvisories: CapabilityAdvisory[];

  // ── Quality and support flags ─────────────────────────────────────────────
  qualityFlag: boolean;
  mentorRequired: boolean;
  recommendedForNewStudents: boolean;

  // ── Admin notes (V2: single field) ────────────────────────────────────────
  // Convention: prepend "[YYYY-MM-DD AdminName] " to each entry.
  // Replace with a reviewHistory subcollection in a future phase if volume warrants.
  adminNotes: string;

  // ── Interview record ──────────────────────────────────────────────────────
  // Philosophy and behavioural assessment belongs here, not in the onboarding form.
  // Admin records key observations from the interview conversation.
  interviewDate: FirestoreTimestamp | null;
  interviewNotes: string;

  // ── Metadata ──────────────────────────────────────────────────────────────
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};
