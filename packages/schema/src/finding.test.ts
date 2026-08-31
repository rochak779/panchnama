import { describe, expect, it } from "vitest";
import { findingSchema } from "./finding.js";
import { validFindingAvailability, validFindingOverlap } from "./fixtures/valid.js";

describe("findingSchema", () => {
  it("parses valid fixtures (both branches of the possible_overlap condition)", () => {
    // Branch 1: category !== "possible_overlap" — overlapComparisonId not required.
    expect(findingSchema.parse(validFindingAvailability)).toEqual(validFindingAvailability);
    expect(validFindingAvailability.overlapComparisonId).toBeUndefined();

    // Branch 2: category === "possible_overlap" — overlapComparisonId present and required.
    expect(findingSchema.parse(validFindingOverlap)).toEqual(validFindingOverlap);
    expect(validFindingOverlap.overlapComparisonId).toBeDefined();
  });

  it("rejects category 'possible_overlap' without overlapComparisonId", () => {
    const { overlapComparisonId: _id, ...withoutComparison } = validFindingOverlap;
    const result = findingSchema.safeParse(withoutComparison);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "overlapComparisonId")).toBe(
        true,
      );
    }
  });

  it("allows a non-'possible_overlap' finding to omit overlapComparisonId", () => {
    expect(validFindingAvailability.category).not.toBe("possible_overlap");
    expect(() => findingSchema.parse(validFindingAvailability)).not.toThrow();
  });

  it("rejects a finding with no evidenceRefs", () => {
    const result = findingSchema.safeParse({ ...validFindingAvailability, evidenceRefs: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "evidenceRefs")).toBe(true);
    }
  });

  it("rejects checkStatus 'not_assessable' with empty limitations", () => {
    const result = findingSchema.safeParse({
      ...validFindingAvailability,
      checkStatus: "not_assessable",
      limitations: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "limitations")).toBe(true);
    }
  });

  it("accepts checkStatus 'not_assessable' with a non-empty limitations entry", () => {
    const finding = {
      ...validFindingAvailability,
      checkStatus: "not_assessable" as const,
      limitations: ["Could not fairly assess due to bot protection."],
    };
    expect(findingSchema.parse(finding).checkStatus).toBe("not_assessable");
  });

  it("rejects an invalid category", () => {
    const result = findingSchema.safeParse({ ...validFindingAvailability, category: "seo" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["category"]);
    }
  });
});
