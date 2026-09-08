import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/siteUrl";

// Conservative on purpose: one allow-all rule for the public site, one
// explicit disallow list naming only genuinely private/authenticated
// application routes — never a broad rule that risks accidentally
// de-indexing the public marketing pages themselves.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/hub",
        "/hub/",
        "/parent",
        "/planner",
        "/onboarding",
        "/subscribe",
        "/lobby",
        "/room",
        "/room/",
        "/tutor-access",
        "/api/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
