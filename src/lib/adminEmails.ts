// src/lib/adminEmails.ts
//
// Single source of truth for which emails count as Admin.
//
// Deliberately has zero dependencies (no firebase-admin, no Node-only APIs) so
// it can be safely imported from both server routes and client components
// (e.g. useUserRole, hub/layout.tsx) without pulling the Admin SDK into the
// browser bundle. src/lib/firebaseAdmin.ts re-exports these for server code
// that already imports from it.

export const ADMIN_EMAILS = new Set([
  "lily.studyroom@gmail.com",
  "contact.studyroomaustralia@gmail.com",
]);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
