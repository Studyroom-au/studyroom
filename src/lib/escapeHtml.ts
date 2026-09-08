/**
 * Escapes the five HTML-significant characters so a submitted value can be
 * safely interpolated into an HTML email body without becoming active markup.
 * Order matters: `&` is escaped first so the entities this creates aren't
 * re-escaped by the later replacements.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
