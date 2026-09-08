import { SITE_URL } from "@/lib/siteUrl";

const SITE_DESCRIPTION =
  "Personalised 1:1 tutoring for Prep to Year 12 students across Logan, Brisbane Southside and online. Calm support for confidence, skills and study routines.";

/**
 * Sitewide Organization schema — describes Studyroom itself (name, url,
 * logo, contact details already public in the Footer), not any one page.
 * Deliberately Organization, not LocalBusiness: Studyroom has no public
 * storefront/office address — tutors travel to students in-home or tutor
 * online — and LocalBusiness schema expects a genuine physical address
 * property, which would mean either omitting a normally-expected field or
 * inventing one. No `sameAs` social links: none are currently published
 * anywhere on the site to confirm.
 */
export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Studyroom Australia",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: SITE_DESCRIPTION,
  email: "contact.studyroomaustralia@gmail.com",
  telephone: "+61447409747",
  areaServed: ["Logan", "Brisbane Southside"],
} as const;
