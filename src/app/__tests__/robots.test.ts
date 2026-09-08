import { describe, it, expect } from "vitest";
import robots from "../robots";

describe("robots.ts (Release 1C SEO addition)", () => {
  it("allows crawling of the public site", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule?.allow).toBe("/");
  });

  it("does not accidentally block the key public acquisition pages", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rule?.disallow) ? rule.disallow : [rule?.disallow].filter(Boolean);
    for (const publicPath of ["/", "/tutoring", "/studyroom", "/become-a-tutor", "/about", "/blog", "/contact", "/enrol"]) {
      expect(disallow).not.toContain(publicPath);
    }
  });

  it("disallows private/authenticated application routes", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rule?.disallow) ? rule.disallow : [rule?.disallow].filter(Boolean);
    for (const privatePath of ["/hub", "/parent", "/planner", "/onboarding", "/subscribe", "/lobby", "/tutor-access"]) {
      expect(disallow).toContain(privatePath);
    }
  });

  it("points to the real sitemap on the real production origin", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://studyroom.au/sitemap.xml");
    expect(result.host).toBe("https://studyroom.au");
  });
});
