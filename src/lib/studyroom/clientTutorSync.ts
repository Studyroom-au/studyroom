// Release 1B correction (pre-Stage-6): a family/client can have multiple
// students, each with their own assigned tutor. clients/{clientId} used to
// carry a single assignedTutorId/assignedTutorEmail, which firestore.rules
// used to grant a tutor read access to the shared parent/contact record —
// meaning the LAST student's tutor assignment silently revoked every other
// sibling's tutor's access. `assignedTutorIds` is the derived, authoritative
// (for read-access purposes) fix: the set of every tutor currently assigned
// to at least one student under this client, recomputed from the students
// collection (never the other way around — student-level assignment stays
// the source of truth). The old singular fields are left in place for
// backward-compatible display only (e.g. "primary" tutor on an admin list),
// never for access control.

/** Pure: dedupes and drops null/empty tutor IDs. Exported for testing. */
export function computeAssignedTutorIds(studentTutorIds: Array<string | null | undefined>): string[] {
  return Array.from(new Set(studentTutorIds.filter((id): id is string => !!id)));
}

/**
 * Whether it's safe to write the legacy singular assignedTutorId/Email/Name
 * fields on a client doc to `newTutorId` — true only if the client doesn't
 * already carry a DIFFERENT tutor there (i.e. a sibling's). These fields are
 * display-only convenience now (see assignedTutorIds above for the real
 * access-control mechanism) but should still never silently overwrite a
 * different sibling's tutor.
 */
export function shouldMirrorSingularTutor(existingClientTutorId: string | null | undefined, newTutorId: string | null | undefined): boolean {
  const existing = existingClientTutorId || "";
  const next = newTutorId || "";
  return !existing || existing === next;
}
