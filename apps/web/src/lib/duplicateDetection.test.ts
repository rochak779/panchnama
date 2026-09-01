import { describe, expect, it } from "vitest";
import {
  findMatchingCandidateId,
  monthRoundOccurredOn,
  normalizeForComparison,
  sortThemesForComparison,
} from "./duplicateDetection";
import type { DuplicateCandidateRow } from "@panchnama/database";

describe("normalizeForComparison", () => {
  it("returns an empty string for empty/absent input", () => {
    expect(normalizeForComparison(null)).toBe("");
    expect(normalizeForComparison(undefined)).toBe("");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeForComparison("  Applied  For   X  ")).toBe("applied for x");
  });
});

describe("sortThemesForComparison", () => {
  it("sorts themes so order does not affect comparison", () => {
    expect(sortThemesForComparison(["navigation", "availability"])).toBe(
      sortThemesForComparison(["availability", "navigation"]),
    );
  });
});

describe("monthRoundOccurredOn", () => {
  it("rounds a full date down to its YYYY-MM prefix", () => {
    expect(monthRoundOccurredOn("2026-08-15")).toBe("2026-08");
  });

  it("leaves a month-only value unchanged", () => {
    expect(monthRoundOccurredOn("2026-08")).toBe("2026-08");
  });

  it("returns an empty string for absent input", () => {
    expect(monthRoundOccurredOn(undefined)).toBe("");
    expect(monthRoundOccurredOn(null)).toBe("");
  });
});

function candidate(overrides: Partial<DuplicateCandidateRow> = {}): DuplicateCandidateRow {
  return {
    id: "candidate-1",
    taskDescription: "Applied for pension",
    themes: ["availability", "navigation"],
    occurredOn: "2026-08-15",
    freeText: "Could not find the form",
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    ...overrides,
  };
}

describe("findMatchingCandidateId", () => {
  it("matches when every normalized field is identical, ignoring case/whitespace/theme order/date precision", () => {
    const match = findMatchingCandidateId(
      {
        taskDescription: "  applied FOR   pension ",
        themes: ["navigation", "availability"],
        occurredOn: "2026-08-20", // same month, different day
        freeText: "could NOT find   the form",
      },
      [candidate()],
    );
    expect(match).toBe("candidate-1");
  });

  it("does not match when free text narrative differs, even with identical structured choices", () => {
    const match = findMatchingCandidateId(
      {
        taskDescription: "Applied for pension",
        themes: ["availability", "navigation"],
        occurredOn: "2026-08-15",
        freeText: "A completely different story about what happened",
      },
      [candidate()],
    );
    expect(match).toBeUndefined();
  });

  it("does not match across different months", () => {
    const match = findMatchingCandidateId(
      {
        taskDescription: "Applied for pension",
        themes: ["availability", "navigation"],
        occurredOn: "2026-09-01",
        freeText: "Could not find the form",
      },
      [candidate()],
    );
    expect(match).toBeUndefined();
  });

  it("returns undefined when there are no candidates", () => {
    expect(
      findMatchingCandidateId(
        { taskDescription: "x", themes: [], occurredOn: undefined, freeText: undefined },
        [],
      ),
    ).toBeUndefined();
  });

  it("returns the first matching candidate's id when multiple candidates are present", () => {
    const match = findMatchingCandidateId(
      {
        taskDescription: "Applied for pension",
        themes: ["availability", "navigation"],
        occurredOn: "2026-08-15",
        freeText: "Could not find the form",
      },
      [candidate({ id: "other" }), candidate({ id: "candidate-1" })],
    );
    expect(match).toBe("other");
  });
});
