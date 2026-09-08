import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";
import { absoluteUrl } from "@/lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public, indexable pages only — no authenticated/application routes
  // (/hub, /parent, /planner, /onboarding, /subscribe, /lobby, /room,
  // /tutor-access), matching robots.ts's disallow list.
  //
  // No changeFrequency/priority: neither reflects a real, trustworthy signal
  // about these pages (nothing tracks how often they actually change), so
  // rather than invent plausible-looking numbers, only genuinely known facts
  // are included — the URL itself, and lastModified where a real date exists.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/") },
    { url: absoluteUrl("/tutoring") },
    { url: absoluteUrl("/studyroom") },
    { url: absoluteUrl("/become-a-tutor") },
    { url: absoluteUrl("/about") },
    { url: absoluteUrl("/contact") },
    { url: absoluteUrl("/enrol") },
    { url: absoluteUrl("/headstart") },
    { url: absoluteUrl("/worksheets") },
    { url: absoluteUrl("/blog") },
  ];

  // getAllPosts already filters published=true and returns [] on Firestore error
  const posts = await getAllPosts();

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    // post.date is a real, editor-supplied publish date — a trustworthy
    // lastModified signal, unlike the removed guessed frequencies above.
    ...(post.date ? { lastModified: new Date(post.date) } : {}),
  }));

  return [...staticRoutes, ...postRoutes];
}
