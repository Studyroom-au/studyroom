import { describe, it, expect } from "vitest";
import { filterCurrentStudents, isCurrentFamilyStatus, isCurrentStudentStatus } from "../currentPopulation";

describe("isCurrentFamilyStatus / isCurrentStudentStatus", () => {
  it("only \"ended\" is non-current for both", () => {
    expect(isCurrentFamilyStatus("ended")).toBe(false);
    expect(isCurrentFamilyStatus("active")).toBe(true);
    expect(isCurrentFamilyStatus(undefined)).toBe(true);
    expect(isCurrentStudentStatus("ended")).toBe(false);
    expect(isCurrentStudentStatus("paused")).toBe(true);
    expect(isCurrentStudentStatus("active")).toBe(true);
  });
});

describe("filterCurrentStudents — root-cause fix for the 55-vs-35 discrepancy", () => {
  const clients = [
    { id: "c1", status: "active" },
    { id: "c2", status: "ended" }, // archived family
  ];

  it("counts an active student under a non-archived family", () => {
    const students = [{ id: "s1", clientId: "c1", status: "active" }];
    expect(filterCurrentStudents(students, clients)).toHaveLength(1);
  });

  it("counts a paused student under a non-archived family (paused is still current)", () => {
    const students = [{ id: "s1", clientId: "c1", status: "paused" }];
    expect(filterCurrentStudents(students, clients)).toHaveLength(1);
  });

  it("excludes an ended student even under a non-archived family", () => {
    const students = [{ id: "s1", clientId: "c1", status: "ended" }];
    expect(filterCurrentStudents(students, clients)).toHaveLength(0);
  });

  it("excludes a student belonging to an archived family, even if their own status still says active", () => {
    const students = [{ id: "s1", clientId: "c2", status: "active" }];
    expect(filterCurrentStudents(students, clients)).toHaveLength(0);
  });

  it("excludes an orphaned student with no clientId", () => {
    const students = [{ id: "s1", clientId: null, status: "active" }];
    expect(filterCurrentStudents(students, clients)).toHaveLength(0);
  });

  it("excludes an orphaned student whose clientId matches no existing client document (the actual 55-vs-35 root cause)", () => {
    const students = [{ id: "s1", clientId: "does-not-exist", status: "active" }];
    expect(filterCurrentStudents(students, clients)).toHaveLength(0);
  });

  it("matches the exact production-shaped scenario: 55 students, 20 orphaned, 35 current", () => {
    const realClients = [{ id: "c1", status: "active" }];
    const students = [
      ...Array.from({ length: 35 }, (_, i) => ({ id: `real-${i}`, clientId: "c1", status: "active" })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: `orphan-${i}`, clientId: `missing-${i}`, status: "active" })),
    ];
    expect(students).toHaveLength(55);
    expect(filterCurrentStudents(students, realClients)).toHaveLength(35);
  });
});
