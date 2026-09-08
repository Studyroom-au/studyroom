import { resolveLinkedSubject } from "@/lib/subjectBadge";

export type MinimalUpcomingDoc = { id: string; subject: string; title: string };
export type MinimalTaskDoc = { id: string; upcomingId?: string };

/**
 * Attaches a resolved `subject` to each task, given a batch of already-known
 * assessments plus a fetcher for any assessment referenced by a task that
 * isn't in that batch (e.g. a since-completed assessment that fell out of an
 * incomplete-only query). Pure/dependency-injected so this can be unit
 * tested without Firestore or auth — see
 * src/app/api/parent/hub-data/route.ts for the real Firestore-backed caller.
 *
 * `fetchUpcomingById` is only ever called for the small, bounded set of
 * assessment IDs actually referenced by a task and not already known —
 * never a broad re-query.
 */
export async function attachResolvedSubjects<T extends MinimalTaskDoc>(
  tasks: T[],
  knownUpcoming: MinimalUpcomingDoc[],
  fetchUpcomingById: (id: string) => Promise<MinimalUpcomingDoc | null>
): Promise<Array<T & { subject?: string }>> {
  const subjectByUpcomingId: Record<string, string> = {};
  const titleByUpcomingId: Record<string, string> = {};
  for (const item of knownUpcoming) {
    subjectByUpcomingId[item.id] = item.subject;
    titleByUpcomingId[item.id] = item.title;
  }

  const missingIds = Array.from(
    new Set(
      tasks
        .map((t) => t.upcomingId)
        .filter((id): id is string => !!id && !(id in subjectByUpcomingId))
    )
  );

  if (missingIds.length > 0) {
    const fetched = await Promise.all(missingIds.map((id) => fetchUpcomingById(id)));
    fetched.forEach((doc, i) => {
      if (doc) {
        subjectByUpcomingId[missingIds[i]] = doc.subject;
        titleByUpcomingId[missingIds[i]] = doc.title;
      }
    });
  }

  return tasks.map((t) => {
    const resolved = t.upcomingId
      ? resolveLinkedSubject(subjectByUpcomingId[t.upcomingId], titleByUpcomingId[t.upcomingId] ?? "")
      : null;
    return { ...t, subject: resolved ?? undefined };
  });
}
