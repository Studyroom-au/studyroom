import { describe, it, expect } from "vitest";
import sitemap from "../sitemap";

describe("sitemap.ts (Release 1C SEO correction)", () => {
  it("never returns an empty sitemap — SITE_URL is always defined now, unlike the old unset-env-var version", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
  });

  it("every entry is an absolute https://studyroom.au URL", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url.startsWith("https://studyroom.au")).toBe(true);
    }
  });

  it("includes every priority public acquisition page", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    for (const path of [
      "/",
      "/tutoring",
      "/studyroom",
      "/become-a-tutor",
      "/about",
      "/contact",
      "/enrol",
      "/headstart",
      "/worksheets",
      "/blog",
    ]) {
      expect(urls).toContain(`https://studyroom.au${path}`);
    }
  });

  it("excludes private/authenticated application routes", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    for (const path of ["/hub", "/hub/admin", "/parent", "/planner", "/onboarding", "/subscribe", "/lobby", "/tutor-access"]) {
      expect(urls.some((u) => u.startsWith(`https://studyroom.au${path}`))).toBe(false);
    }
  });

  it("does not invent changeFrequency or priority values for any entry", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry).not.toHaveProperty("changeFrequency");
      expect(entry).not.toHaveProperty("priority");
    }
  });
});
