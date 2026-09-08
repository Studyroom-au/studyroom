// Field options for the public tutor-application intake (Release 1C).
// Deliberately separate from src/lib/studyroom/tutorConstants.ts, which
// governs the operational tutors/{uid} profile — this is a pre-account
// recruitment question set, not the profile matching taxonomy.

export const MODE_OPTIONS = [
  { value: "in_home", label: "In-home" },
  { value: "online", label: "Online" },
  { value: "both", label: "Both" },
] as const;

export type ModePreference = (typeof MODE_OPTIONS)[number]["value"];

export const BLUE_CARD_STATUS_OPTIONS = [
  { value: "current", label: "I currently hold a Blue Card" },
  { value: "in_progress", label: "Application in progress" },
  { value: "not_yet", label: "Not yet, but willing to obtain one" },
] as const;

export type BlueCardStatus = (typeof BLUE_CARD_STATUS_OPTIONS)[number]["value"];

export const ABN_STATUS_OPTIONS = [
  { value: "have_abn", label: "I have an ABN" },
  { value: "willing_to_obtain", label: "Willing to obtain one" },
  { value: "not_sure", label: "Not sure / need guidance" },
] as const;

export type AbnStatus = (typeof ABN_STATUS_OPTIONS)[number]["value"];

export const REFERRAL_SOURCE_OPTIONS = [
  "Facebook",
  "Instagram",
  "University group",
  "Friend or colleague",
  "Google search",
  "Other",
] as const;

/** Internal triage state only — never the business recruitment pipeline. */
export const REVIEW_STATUS_VALUES = ["new", "reviewed", "archived"] as const;
export type ReviewStatus = (typeof REVIEW_STATUS_VALUES)[number];
