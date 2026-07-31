import { describe, it, expect } from "vitest";
import { computeAssignedTutorIds, shouldMirrorSingularTutor } from "../clientTutorSync";

describe("computeAssignedTutorIds", () => {
  it("dedupes tutor ids", () => {
    expect(computeAssignedTutorIds(["tutor-a", "tutor-a", "tutor-b"]).sort()).toEqual(["tutor-a", "tutor-b"]);
  });

  it("drops null/undefined/empty entries", () => {
    expect(computeAssignedTutorIds(["tutor-a", null, undefined, ""]).sort()).toEqual(["tutor-a"]);
  });

  it("returns an empty array when no student has a tutor", () => {
    expect(computeAssignedTutorIds([null, undefined])).toEqual([]);
  });

  it("supports multiple distinct tutors for siblings", () => {
    expect(computeAssignedTutorIds(["tutor-a", "tutor-b"]).sort()).toEqual(["tutor-a", "tutor-b"]);
  });
});

describe("shouldMirrorSingularTutor", () => {
  it("mirrors when the client has no existing tutor", () => {
    expect(shouldMirrorSingularTutor("", "tutor-a")).toBe(true);
    expect(shouldMirrorSingularTutor(null, "tutor-a")).toBe(true);
  });

  it("mirrors when the existing tutor is the same one being assigned (no-op)", () => {
    expect(shouldMirrorSingularTutor("tutor-a", "tutor-a")).toBe(true);
  });

  it("does not mirror when a different tutor is already recorded (a sibling's)", () => {
    expect(shouldMirrorSingularTutor("tutor-a", "tutor-b")).toBe(false);
  });
});
