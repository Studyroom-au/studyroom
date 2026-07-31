// src/lib/studyroom/operationsCutover.ts
//
// Operations Cutover Date (final pre-release addition) — the smallest safe
// concept needed to let the new Release 1B operational exception system
// (Needs Attention on /hub/admin and /hub/admin/sessions) start clean
// without touching a single historical record.
//
// Sessions whose current scheduled date (startAt — never originalStartAt,
// which is the separate pricing-lock field) is before this cutover never
// generate a Needs Attention exception under the new rules — they remain
// fully browseable as history, just not re-litigated under rules that
// didn't exist when they were created. A rescheduled session is judged by
// where it's now scheduled to occur, not where it was originally booked;
// see sessionExceptions.ts for the full reasoning.
// Sessions on/after the cutover are subject to the full Release 1B
// exception rules. This never deletes, hides, or rewrites any session,
// invoice, plan, or lead — it only narrows which sessions the DERIVED
// exception queries (on both admin pages) are allowed to flag.
//
// Read pattern mirrors casualPricing.ts / packagePricing.ts: a single
// settings/ doc, admin-editable only, with a safe hardcoded fallback so a
// missing/misconfigured document never silently produces a "wrong" answer
// (here: never silently re-floods the dashboard with pre-cutover noise, and
// never silently suppresses genuine new exceptions either).

import { doc, getDoc, type Firestore } from "firebase/firestore";

export const OPERATIONS_CUTOVER_COLLECTION = "settings";
export const OPERATIONS_CUTOVER_DOC_ID = "operationsCutover";

// Fallback used only when settings/operationsCutover hasn't been configured
// yet in Firestore — NEVER auto-written; this is purely an in-memory
// default until an admin explicitly saves a value via the Settings page.
// Chosen per scripts/audit-needs-attention-sessions.js: the day after the
// last currently-flagged (old/test/pre-Release-1B) session in production at
// the time this was written. Confirm/move this forward at actual
// production go-live time if the release ships later than this date.
export const DEFAULT_OPERATIONS_CUTOVER_ISO = "2026-07-31T00:00:00+10:00";

/**
 * Reads the configured operations cutover instant, falling back to the
 * hardcoded default if settings/operationsCutover is missing or malformed.
 * Never throws.
 */
export async function getOperationsCutoverAt(db: Firestore): Promise<Date> {
  try {
    const snap = await getDoc(doc(db, OPERATIONS_CUTOVER_COLLECTION, OPERATIONS_CUTOVER_DOC_ID));
    if (snap.exists()) {
      const iso = snap.data()?.operationsCutoverAt;
      if (typeof iso === "string") {
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d;
      }
    }
  } catch (e) {
    console.error("[getOperationsCutoverAt] Firestore read failed, using default:", e);
  }
  return new Date(DEFAULT_OPERATIONS_CUTOVER_ISO);
}
