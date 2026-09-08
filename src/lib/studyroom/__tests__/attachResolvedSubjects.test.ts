import { describe, it, expect, vi } from "vitest";
import { attachResolvedSubjects } from "../attachResolvedSubjects";

describe("attachResolvedSubjects — parent-portal subject coverage (Release 1C correction)", () => {
  it("resolves subject from the already-known (incomplete) upcoming batch with no fetch", async () => {
    const fetcher = vi.fn(async () => null);
    const result = await attachResolvedSubjects(
      [{ id: "t1", upcomingId: "a1" }],
      [{ id: "a1", subject: "Maths", title: "Algebra Test" }],
      fetcher
    );
    expect(result[0].subject).toBe("Maths");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back to a targeted lookup for a task linked to a COMPLETED assessment not in the known batch", async () => {
    const fetcher = vi.fn(async (id: string) =>
      id === "a-completed" ? { id, subject: "History", title: "History Investigation" } : null
    );
    const result = await attachResolvedSubjects(
      [{ id: "t1", upcomingId: "a-completed" }],
      [], // nothing in the incomplete-only batch — assessment has since been completed
      fetcher
    );
    expect(result[0].subject).toBe("History");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("a-completed");
  });

  it("derives subject from the ASSESSMENT title, not the checkpoint/task title, when the assessment's subject field is blank", async () => {
    const fetcher = vi.fn(async () => null);
    const result = await attachResolvedSubjects(
      [{ id: "t1", upcomingId: "a1" }],
      [{ id: "a1", subject: "", title: "History Investigation" }],
      fetcher
    );
    expect(result[0].subject).toBe("History");
  });

  it("shows no badge (undefined subject) when there's insufficient evidence, rather than a generic guess", async () => {
    const fetcher = vi.fn(async () => null);
    const result = await attachResolvedSubjects(
      [{ id: "t1", upcomingId: "a1" }],
      [{ id: "a1", subject: "", title: "Assessment 2" }],
      fetcher
    );
    expect(result[0].subject).toBeUndefined();
  });

  it("leaves a manual task (no upcomingId) with no subject and never calls the fetcher for it", async () => {
    const fetcher = vi.fn(async () => null);
    const result = await attachResolvedSubjects([{ id: "manual-1" }], [], fetcher);
    expect(result[0].subject).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("dedupes: calls the fetcher exactly once per distinct missing assessment ID, even with multiple tasks sharing it", async () => {
    const fetcher = vi.fn(async (id: string) => ({ id, subject: "Science", title: "Science Report" }));
    const result = await attachResolvedSubjects(
      [
        { id: "t1", upcomingId: "shared" },
        { id: "t2", upcomingId: "shared" },
      ],
      [],
      fetcher
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result[0].subject).toBe("Science");
    expect(result[1].subject).toBe("Science");
  });

  it("handles a fetcher returning null (assessment doc no longer exists) without crashing, and shows no badge", async () => {
    const fetcher = vi.fn(async () => null);
    const result = await attachResolvedSubjects([{ id: "t1", upcomingId: "gone" }], [], fetcher);
    expect(result[0].subject).toBeUndefined();
  });
});
