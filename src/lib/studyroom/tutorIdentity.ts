// src/lib/studyroom/tutorIdentity.ts
//
// Canonical tutor identity resolution (pre-Release identity/profile fix).
//
// email:  Firebase Auth is the single source of truth — no in-app flow ever
//         changes a user's Auth email, so users/{uid}.email is always just a
//         cheap Firestore mirror of it, safe to (re)sync whenever it's
//         missing or stale. Never treat a separate "profile email" as a
//         competing concept.
// name:   captured once, at signup, from whichever tutor_invite/tutor_request
//         lead matches the account's email (the name Lily typed when
//         inviting, or the tutor typed when requesting access) — the closest
//         thing this app has to a canonical signup name. Never overwritten
//         once set, so an admin correction always sticks.
//
// Used by /api/tutor/redeem-code (signup time), /api/tutors/profile (self-heal
// on load), and /api/admin/tutors/resolve-identity (on-demand backfill for
// tutors who signed up before this fix existed).

import type { Firestore } from "firebase-admin/firestore";

/**
 * Finds the name from the tutor's own invite/request lead, if any.
 * Returns "" if no matching lead (or no name on it) is found.
 */
export async function resolveTutorNameFromLeads(db: Firestore, email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "";

  const snap = await db.collection("leads").where("email", "==", normalized).get();
  for (const doc of snap.docs) {
    const data = doc.data();
    const type = String(data.type ?? "");
    const name = String(data.name ?? "").trim();
    if ((type === "tutor_invite" || type === "tutor_request") && name) {
      return name;
    }
  }
  return "";
}
