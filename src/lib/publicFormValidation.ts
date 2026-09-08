// Shared server-side validation/attribution helpers for the Release 1C public
// forms (Hub early access, tutor applications). Mirrors the hand-rolled
// trim/length-cap style already used in /api/enquiry — this codebase has no
// schema-validation library, so new routes match the existing convention
// rather than introducing one.

export function cleanStr(s: unknown, max = 500): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

// Deliberately conservative: enforces ONE plausible email address, not full
// RFC 5321 syntax. No excluded character (whitespace, @, <, >, comma,
// semicolon) can appear in the local or domain part, which rules out
// multiple/CC-style recipients and angle-bracket "Name <addr>" forms; the
// domain must contain a dot with a non-empty label on each side.
const SINGLE_EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export function isValidEmail(s: string): boolean {
  if (typeof s !== "string") return false;
  if (s.length === 0 || s.length > 200) return false;
  // Reject any control character (CR, LF, NUL, etc.) outright — defence
  // against email-header injection, even though \s already blocks CR/LF
  // from appearing inside the matched local/domain parts below.
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 0x20) return false;
  }
  return SINGLE_EMAIL_RE.test(s);
}

export type Attribution = {
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

export function cleanAttribution(body: Record<string, unknown>): Attribution {
  return {
    referrer: cleanStr(body.referrer, 500),
    utm_source: cleanStr(body.utm_source, 200),
    utm_medium: cleanStr(body.utm_medium, 200),
    utm_campaign: cleanStr(body.utm_campaign, 200),
  };
}

/** Name of the shared hidden honeypot field used by both new public forms. */
export const HONEYPOT_FIELD = "companyWebsite";

/** A filled-in honeypot means a bot submitted the form — reject silently as if it succeeded. */
export function isHoneypotTripped(body: Record<string, unknown>): boolean {
  const v = body[HONEYPOT_FIELD];
  return typeof v === "string" && v.trim().length > 0;
}
