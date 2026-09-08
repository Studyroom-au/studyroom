// Canonical production origin — the single source of truth for metadataBase,
// per-page canonical URLs, the sitemap, robots.txt, and JSON-LD.
//
// Deliberately hardcoded rather than read from NEXT_PUBLIC_BASE_URL: that env
// var is unset in this project's .env.local (the only base-URL var actually
// set is NEXT_PUBLIC_APP_URL, pointed at the insecure "http://" scheme, and
// nothing reads it for SEO purposes). Depending on an unset/wrong-scheme env
// var is exactly what silently made src/app/sitemap.ts return an empty
// sitemap and the blog post page's canonical/OG URL silently undefined —
// getting this value wrong breaks SEO with no visible error, which isn't
// worth the fragility of an optional env var for one known, stable domain.
export const SITE_URL = "https://studyroom.au";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Reads NEXT_PUBLIC_APP_URL (used elsewhere as the base for Stripe
 * redirect/callback URLs) and upgrades it to https ONLY when it points at
 * the real production domain — this project's .env.local currently has it
 * as "http://studyroom.au". Any other value (localhost, a Vercel preview
 * URL, etc.) is returned exactly as configured, so local development and
 * other environments are never redirected at production or broken.
 */
export function secureAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return raw.startsWith("http://studyroom.au") ? raw.replace(/^http:\/\//, "https://") : raw;
}
