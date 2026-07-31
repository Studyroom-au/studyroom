// src/lib/studyroom/currentPopulation.ts
//
// Single canonical definition of "current family" and "current student" —
// used by BOTH /hub/admin (Operations Centre) and /hub/admin/clients so the
// two can never drift apart again (final pre-release fix).
//
// Root cause of the 55-vs-35 discrepancy this replaces: the Operations
// Centre only excluded a student if their clientId matched a client
// document that was KNOWN to be archived. A student whose clientId pointed
// at nothing at all (no matching client document — an orphaned/test
// record) was never excluded, so it silently counted as "active". The
// Clients page never had this problem because it only ever iterates
// students reachable from an actually-existing, non-archived client
// document in the first place — an orphaned clientId simply never appears
// in any row. This module makes that same "must resolve to a real,
// non-archived client" rule the one shared implementation.

/** A family/client is "current" (not archived/ended) — mirrors the Clients page's isCurrentStudent-for-clients check. */
export function isCurrentFamilyStatus(status?: string | null): boolean {
  return status !== "ended";
}

/** A student is "current" by their OWN status — Active or Paused both count; only Ended excludes. */
export function isCurrentStudentStatus(status?: string | null): boolean {
  return status !== "ended";
}

export type MinimalClient = { id: string; status?: string | null };
export type MinimalStudent = { id: string; clientId?: string | null; status?: string | null };

/**
 * Filters `students` down to exactly the "Current Students" population:
 * belongs to an actually-existing, non-archived client, AND is not Ended
 * (Paused counts). Orphaned students (missing clientId, or a clientId with
 * no matching client document) are excluded — they were never real current
 * family members, so they must never inflate any operational count.
 */
export function filterCurrentStudents<S extends MinimalStudent>(
  students: readonly S[],
  clients: readonly MinimalClient[]
): S[] {
  const nonArchivedClientIds = new Set(
    clients.filter((c) => isCurrentFamilyStatus(c.status)).map((c) => c.id)
  );
  return students.filter((s) => {
    const clientId = s.clientId || "";
    if (!clientId || !nonArchivedClientIds.has(clientId)) return false;
    return isCurrentStudentStatus(s.status);
  });
}
