import { describe, it, expect } from "vitest";
import { ORGANIZATION_JSON_LD } from "../organizationJsonLd";

describe("ORGANIZATION_JSON_LD — sitewide structured data", () => {
  it("is valid, parseable JSON with no circular references or serialisation errors", () => {
    expect(() => JSON.stringify(ORGANIZATION_JSON_LD)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(ORGANIZATION_JSON_LD));
    expect(roundTripped).toEqual(ORGANIZATION_JSON_LD);
  });

  it("declares the required schema.org Organization fields", () => {
    expect(ORGANIZATION_JSON_LD["@context"]).toBe("https://schema.org");
    expect(ORGANIZATION_JSON_LD["@type"]).toBe("Organization");
    expect(ORGANIZATION_JSON_LD.name).toBe("Studyroom Australia");
    expect(ORGANIZATION_JSON_LD.url).toBe("https://studyroom.au");
    expect(ORGANIZATION_JSON_LD.logo).toBe("https://studyroom.au/logo.png");
  });

  it("does not claim LocalBusiness-only properties (no address, no fabricated storefront)", () => {
    expect(ORGANIZATION_JSON_LD).not.toHaveProperty("address");
  });

  it("does not invent ratings, reviews, or pricing that don't exist on the site", () => {
    expect(ORGANIZATION_JSON_LD).not.toHaveProperty("aggregateRating");
    expect(ORGANIZATION_JSON_LD).not.toHaveProperty("review");
    expect(ORGANIZATION_JSON_LD).not.toHaveProperty("priceRange");
    expect(ORGANIZATION_JSON_LD).not.toHaveProperty("offers");
  });

  it("does not include sameAs — no confirmed public social profile links exist to cite", () => {
    expect(ORGANIZATION_JSON_LD).not.toHaveProperty("sameAs");
  });
});
