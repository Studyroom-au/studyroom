// Release 1B, Stage 5c: canonical enrolment field lists, shared between the
// public /enrol form and the admin "Add Existing Student" form, so both
// collect the same information the same way — one concept of a student, not
// two independently-maintained ones.

export const SUBJECT_OPTIONS = [
  "Maths",
  "English",
  "Science",
  "Humanities",
  "Study skills",
  "Organisation",
  "Reading",
  "Spelling",
  "Writing",
];

export const YEAR_LEVELS = [
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
  "Year 11",
  "Year 12",
];

export const AVAILABILITY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const AVAILABILITY_SLOTS = [
  "Before school (6am - 8am)",
  "Morning (8am - 10am)",
  "Midday (10am - 1pm)",
  "Early afternoon (1pm - 3pm)",
  "After school (3pm - 5pm)",
  "Evening (5pm - 7pm)",
  "Late Evening (After 7pm)",
] as const;

export function makeAvailabilityBlock(day: string, slot: string) {
  return `${day}|${slot}`;
}

/**
 * Canonical enrolment validation — the same rules the public /enrol form and
 * its API route enforce. `requireAvailability` defaults to true (matching the
 * public form) but can be relaxed to false for admin backfill of an existing
 * student whose schedule is already established elsewhere.
 */
export function validateEnrolmentFields(fields: {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  yearLevel: string;
  subjects: string[];
  mode: "online" | "in-home";
  suburb: string;
  availabilityBlocks: string[];
  requireAvailability?: boolean;
}): string | null {
  if (fields.parentName.trim().length < 2) return "Parent name is required.";
  if (!fields.parentEmail.includes("@")) return "A valid parent email is required.";
  if (fields.parentPhone.trim().length < 8) return "A valid parent phone number is required.";
  if (fields.studentName.trim().length < 2) return "Student name is required.";
  if (!fields.yearLevel.trim()) return "Year level is required.";
  if (fields.subjects.length < 1) return "Select at least one subject.";
  if (fields.mode === "in-home" && fields.suburb.trim().length < 2) return "Suburb is required for in-home tutoring.";
  if ((fields.requireAvailability ?? true) && fields.availabilityBlocks.length < 1) {
    return "Select at least one availability time.";
  }
  return null;
}
