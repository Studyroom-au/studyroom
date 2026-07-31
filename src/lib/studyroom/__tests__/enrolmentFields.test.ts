import { describe, it, expect } from "vitest";
import { makeAvailabilityBlock, validateEnrolmentFields } from "../enrolmentFields";

const validFields = {
  parentName: "Jane Doe",
  parentEmail: "jane@example.com",
  parentPhone: "0400000000",
  studentName: "Alex Doe",
  yearLevel: "Year 6",
  subjects: ["Maths"],
  mode: "in-home" as const,
  suburb: "Toowong",
  availabilityBlocks: ["Mon|Morning (8am - 10am)"],
};

describe("makeAvailabilityBlock", () => {
  it("joins day and slot with a pipe", () => {
    expect(makeAvailabilityBlock("Mon", "Morning (8am - 10am)")).toBe("Mon|Morning (8am - 10am)");
  });
});

describe("validateEnrolmentFields", () => {
  it("returns null when everything is valid", () => {
    expect(validateEnrolmentFields(validFields)).toBeNull();
  });

  it("requires a parent name of at least 2 characters", () => {
    expect(validateEnrolmentFields({ ...validFields, parentName: "J" })).toMatch(/parent name/i);
  });

  it("requires a valid email", () => {
    expect(validateEnrolmentFields({ ...validFields, parentEmail: "not-an-email" })).toMatch(/valid parent email/i);
  });

  it("requires a phone number of at least 8 characters", () => {
    expect(validateEnrolmentFields({ ...validFields, parentPhone: "123" })).toMatch(/phone/i);
  });

  it("requires at least one subject", () => {
    expect(validateEnrolmentFields({ ...validFields, subjects: [] })).toMatch(/subject/i);
  });

  it("requires suburb when mode is in-home", () => {
    expect(validateEnrolmentFields({ ...validFields, suburb: "" })).toMatch(/suburb/i);
  });

  it("does not require suburb when mode is online", () => {
    expect(validateEnrolmentFields({ ...validFields, mode: "online", suburb: "" })).toBeNull();
  });

  it("requires availability by default", () => {
    expect(validateEnrolmentFields({ ...validFields, availabilityBlocks: [] })).toMatch(/availability/i);
  });

  it("allows skipping the availability requirement when requireAvailability is false", () => {
    expect(validateEnrolmentFields({ ...validFields, availabilityBlocks: [], requireAvailability: false })).toBeNull();
  });
});
