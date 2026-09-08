import { describe, it, expect } from "vitest";
import { detectSubjectFromTitle, getSubjectBadgeColor, resolveLinkedSubject } from "../subjectBadge";

describe("resolveLinkedSubject — Release 1C subject badge", () => {
  it("uses the assessment's own subject when present", () => {
    expect(resolveLinkedSubject("History", "History Investigation")).toBe("History");
  });

  it("trims whitespace-only subject and falls back to detection on the ASSESSMENT title", () => {
    expect(resolveLinkedSubject("   ", "Algebra revision assessment")).toBe("Maths");
  });

  it("falls back to detection on the assessment title when subject is missing entirely", () => {
    expect(resolveLinkedSubject(undefined, "English essay assessment")).toBe("English");
  });

  it("falls back to detection on the assessment title when subject is an empty string", () => {
    expect(resolveLinkedSubject("", "Chemistry prac report")).toBe("Chemistry");
  });

  it("resolves subject from a generic checkpoint title via the owning ASSESSMENT's title, not the checkpoint's own title", () => {
    // The checkpoint/task title itself ("Write introduction") carries no
    // subject signal — only the assessment's title does.
    expect(resolveLinkedSubject(undefined, "History Investigation")).toBe("History");
  });

  it("returns null (no badge) when neither the subject nor the assessment title gives confident evidence", () => {
    expect(resolveLinkedSubject(null, "Assessment 2")).toBeNull();
  });

  it("returns null when both subject and assessment title are blank", () => {
    expect(resolveLinkedSubject("", "")).toBeNull();
  });
});

describe("detectSubjectFromTitle", () => {
  it.each([
    ["Finish the calculus homework", "Maths"],
    ["Write introduction for essay", "English"],
    ["Chemistry prac report", "Chemistry"],
    ["Physics revision notes", "Physics"],
    ["Biology diagram labelling", "Biology"],
    ["Japanese vocab quiz", "Japanese"],
    ["History Investigation", "History"],
  ])("detects %s -> %s", (title, expected) => {
    expect(detectSubjectFromTitle(title)).toBe(expected);
  });

  it("returns null (not a guessed default) when nothing matches a known subject", () => {
    expect(detectSubjectFromTitle("Complete Questions 1-3")).toBeNull();
    expect(detectSubjectFromTitle("Assessment 2")).toBeNull();
  });
});

describe("getSubjectBadgeColor", () => {
  it("returns the mapped colour for a known subject", () => {
    expect(getSubjectBadgeColor("Maths")).toBe("#456071");
  });

  it("falls back to the default brand colour for an unknown subject", () => {
    expect(getSubjectBadgeColor("Woodwork")).toBe("#456071");
  });
});
