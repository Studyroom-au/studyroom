import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

function url(path: string): string {
  return `${SITE_URL}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sitemap requires absolute URLs — skip entirely if base URL is not configured
  if (!SITE_URL) return [];

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1.0 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.8 },
    { url: url("/tutoring"), changeFrequency: "monthly", priority: 0.9 },
    { url: url("/contact"), changeFrequency: "monthly", priority: 0.7 },
    { url: url("/blog"), changeFrequency: "weekly", priority: 0.8 },
  ];

  // getAllPosts already filters published=true and returns [] on Firestore error
  const posts = await getAllPosts();

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: url(`/blog/${post.slug}`),
    lastModified: post.date ? new Date(post.date) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...postRoutes];
}
