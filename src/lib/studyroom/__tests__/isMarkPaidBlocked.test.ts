import { describe, it, expect } from "vitest";
import { isMarkPaidBlocked } from "../billing";

describe("isMarkPaidBlocked", () => {
  it("blocks void, credited, and waived invoices", () => {
    expect(isMarkPaidBlocked("void")).toBe(true);
    expect(isMarkPaidBlocked("credited")).toBe(true);
    expect(isMarkPaidBlocked("waived")).toBe(true);
  });

  it("allows every other status to be marked paid", () => {
    for (const status of ["pending_xero", "draft_created", "approved", "sent", "overdue", "xero_failed", "paid"]) {
      expect(isMarkPaidBlocked(status)).toBe(false);
    }
  });
});
