import { describe, it, expect, vi } from "vitest";
import type { Firestore, DocumentSnapshot } from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
}));

import { getDoc } from "firebase/firestore";
import { getOperationsCutoverAt, DEFAULT_OPERATIONS_CUTOVER_ISO } from "../operationsCutover";

const mockedGetDoc = vi.mocked(getDoc);
const fakeDb = {} as Firestore;

function fakeSnap(exists: boolean, data?: Record<string, unknown>): DocumentSnapshot {
  return {
    exists: () => exists,
    data: () => data,
  } as unknown as DocumentSnapshot;
}

describe("getOperationsCutoverAt — safe fallback, never throws (final pre-release addition)", () => {
  it("falls back to the hardcoded default when settings/operationsCutover doesn't exist", async () => {
    mockedGetDoc.mockResolvedValueOnce(fakeSnap(false));
    const result = await getOperationsCutoverAt(fakeDb);
    expect(result.getTime()).toBe(new Date(DEFAULT_OPERATIONS_CUTOVER_ISO).getTime());
  });

  it("falls back when the stored value is missing/not a string", async () => {
    mockedGetDoc.mockResolvedValueOnce(fakeSnap(true, {}));
    const result = await getOperationsCutoverAt(fakeDb);
    expect(result.getTime()).toBe(new Date(DEFAULT_OPERATIONS_CUTOVER_ISO).getTime());
  });

  it("falls back when the stored value is an invalid date string", async () => {
    mockedGetDoc.mockResolvedValueOnce(fakeSnap(true, { operationsCutoverAt: "not-a-date" }));
    const result = await getOperationsCutoverAt(fakeDb);
    expect(result.getTime()).toBe(new Date(DEFAULT_OPERATIONS_CUTOVER_ISO).getTime());
  });

  it("returns the configured value when valid", async () => {
    mockedGetDoc.mockResolvedValueOnce(fakeSnap(true, { operationsCutoverAt: "2026-09-01T00:00:00+10:00" }));
    const result = await getOperationsCutoverAt(fakeDb);
    expect(result.getTime()).toBe(new Date("2026-09-01T00:00:00+10:00").getTime());
  });

  it("never throws — a Firestore read failure falls back rather than crashing the caller", async () => {
    mockedGetDoc.mockRejectedValueOnce(new Error("simulated Firestore outage"));
    const result = await getOperationsCutoverAt(fakeDb);
    expect(result.getTime()).toBe(new Date(DEFAULT_OPERATIONS_CUTOVER_ISO).getTime());
  });
});
