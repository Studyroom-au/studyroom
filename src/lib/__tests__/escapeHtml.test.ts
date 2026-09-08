import { describe, it, expect } from "vitest";
import { escapeHtml } from "../escapeHtml";

describe("escapeHtml", () => {
  it("escapes an ampersand", () => {
    expect(escapeHtml("Smith & Sons")).toBe("Smith &amp; Sons");
  });

  it("escapes angle brackets so a script tag cannot become active HTML", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes double quotes so an attribute cannot be broken out of", () => {
    expect(escapeHtml(`" onmouseover="alert(1)`)).toBe("&quot; onmouseover=&quot;alert(1)");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });

  it("escapes a combined injection attempt with all five special characters", () => {
    const input = `<img src=x onerror="alert('xss')"> & more`;
    const result = escapeHtml(input);
    expect(result).not.toContain("<img");
    expect(result).not.toContain('"alert');
    expect(result).toBe("&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; more");
  });

  it("does not double-escape an ampersand introduced by its own escaping", () => {
    // If '&' were escaped after '<'/'>', the '&' inside "&lt;" would be
    // re-escaped into "&amp;lt;" — assert that does NOT happen.
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("<").includes("&amp;lt;")).toBe(false);
  });

  it("leaves ordinary text unchanged", () => {
    expect(escapeHtml("Jamie Student, Year 9")).toBe("Jamie Student, Year 9");
  });

  it("handles an empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
