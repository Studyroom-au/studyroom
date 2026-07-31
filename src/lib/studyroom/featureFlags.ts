// src/lib/studyroom/featureFlags.ts

// Release 1B, final polish: Work Samples upload is temporarily hidden from
// the tutor-facing UI while Studyroom isn't paying for the required storage.
// This is a UI-only toggle — existing stored files/metadata are untouched,
// and every upload/save code path stays intact; flipping this back to true
// restores the feature everywhere with no other code changes needed.
export const WORK_SAMPLES_UPLOAD_ENABLED = false;

// Release 1B, final polish item 2: tutors shouldn't see billing/invoice/price
// info on the sessions page — they should focus on session -> student ->
// time -> mode/location -> notes -> attendance/outcome -> reschedule/cancel/
// complete. This is a UI-only toggle on the tutor-facing display; the
// billing engine (applySessionAction, Xero push, invoice creation) is
// completely unaffected, and admin's own finance visibility is untouched
// since the admin Invoices page never reads this flag.
export const TUTOR_FINANCE_INFO_VISIBLE = false;
