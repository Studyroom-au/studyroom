import { describe, it, expect, afterEach } from "vitest";
import { SITE_URL, absoluteUrl, secureAppUrl } from "../siteUrl";

describe("siteUrl", () => {
  it("SITE_URL is the real production https origin, with no trailing slash", () => {
    expect(SITE_URL).toBe("https://studyroom.au");
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  it("absoluteUrl joins a leading-slash path onto SITE_URL", () => {
    expect(absoluteUrl("/tutoring")).toBe("https://studyroom.au/tutoring");
  });

  it("absoluteUrl tolerates a path without a leading slash", () => {
    expect(absoluteUrl("tutoring")).toBe("https://studyroom.au/tutoring");
  });

  it("absoluteUrl resolves the root path correctly", () => {
    expect(absoluteUrl("/")).toBe("https://studyroom.au/");
  });
});

describe("secureAppUrl — audits NEXT_PUBLIC_APP_URL usage in Stripe redirect URLs", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("upgrades the known production domain from http to https", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://studyroom.au";
    expect(secureAppUrl()).toBe("https://studyroom.au");
  });

  it("leaves an already-https production value untouched", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://studyroom.au";
    expect(secureAppUrl()).toBe("https://studyroom.au");
  });

  it("leaves a local development URL untouched — never redirects local dev at production", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(secureAppUrl()).toBe("http://localhost:3000");
  });

  it("leaves an unrelated host (e.g. a Vercel preview URL) untouched", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://studyroom-preview-abc123.vercel.app";
    expect(secureAppUrl()).toBe("http://studyroom-preview-abc123.vercel.app");
  });

  it("returns an empty string, not a crash, when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(secureAppUrl()).toBe("");
  });
});
