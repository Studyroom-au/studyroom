// Subject badge colours/heuristic shared by surfaces that render assessment-linked
// checkpoints/tasks outside the assessment's own detail view (which already shows
// subject directly). Mirrors the colour map and detection heuristic already used
// in src/app/hub/page.tsx so badges look the same wherever they appear.
export const SUBJECT_BADGE_COLORS: Record<string, string> = {
  Maths: "#456071",
  English: "#82977e",
  Chemistry: "#748398",
  Physics: "#e39bb6",
  Japanese: "#c4a464",
  Biology: "#7aa8c0",
  History: "#8b7d6b",
  Study: "#c4bbaf",
};

export function getSubjectBadgeColor(subject: string): string {
  return SUBJECT_BADGE_COLORS[subject] ?? "#456071";
}

/**
 * Confident keyword detection only. Returns null — not a guessed default —
 * when nothing in the title matches a known subject, so callers never show
 * a misleading generic badge on insufficient evidence.
 */
export function detectSubjectFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("math") || t.includes("calculus") || t.includes("algebra")) return "Maths";
  if (t.includes("english") || t.includes("essay") || t.includes("lit")) return "English";
  if (t.includes("chem")) return "Chemistry";
  if (t.includes("phys")) return "Physics";
  if (t.includes("bio")) return "Biology";
  if (t.includes("japan")) return "Japanese";
  if (t.includes("history")) return "History";
  return null;
}

/**
 * Resolves a display subject for an assessment-linked task/checkpoint.
 * Only call this when the item is actually linked to an assessment (e.g. has
 * an upcomingId) — manual items should show no badge at all.
 *
 * `assessmentTitle` must be the OWNING ASSESSMENT's title, not the
 * checkpoint/task's own title — a checkpoint like "Write introduction" carries
 * no subject signal of its own; "History Investigation" (the assessment) does.
 *
 * Priority: (1) the assessment's stored subject, (2) confident keyword
 * detection from the assessment's title, (3) no badge at all — never a
 * generic "Study" guess on insufficient evidence.
 */
export function resolveLinkedSubject(subject: string | undefined | null, assessmentTitle: string): string | null {
  const trimmed = (subject ?? "").trim();
  if (trimmed) return trimmed;
  return detectSubjectFromTitle(assessmentTitle);
}
