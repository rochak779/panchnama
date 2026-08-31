import { describe, expect, it } from "vitest";
import { portalOverlapComparisonSchema } from "./overlap.js";
import { validPortalOverlapComparison } from "./fixtures/valid.js";

describe("portalOverlapComparisonSchema", () => {
  it("parses a valid fixture", () => {
    expect(portalOverlapComparisonSchema.parse(validPortalOverlapComparison)).toEqual(
      validPortalOverlapComparison,
    );
  });

  it("rejects portalIdA === portalIdB", () => {
    const result = portalOverlapComparisonSchema.safeParse({
      ...validPortalOverlapComparison,
      portalIdB: validPortalOverlapComparison.portalIdA,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "portalIdB")).toBe(true);
    }
  });

  it("rejects an empty evidenceRefs array", () => {
    const result = portalOverlapComparisonSchema.safeParse({
      ...validPortalOverlapComparison,
      evidenceRefs: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "evidenceRefs")).toBe(true);
    }
  });

  it("rejects the forbidden conclusion 'duplicate'", () => {
    const result = portalOverlapComparisonSchema.safeParse({
      ...validPortalOverlapComparison,
      conclusion: "duplicate",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["conclusion"]);
    }
  });

  it("rejects the forbidden conclusion 'redundant'", () => {
    const result = portalOverlapComparisonSchema.safeParse({
      ...validPortalOverlapComparison,
      conclusion: "redundant",
    });
    expect(result.success).toBe(false);
  });

  it("rejects status values other than 'completed'", () => {
    const result = portalOverlapComparisonSchema.safeParse({
      ...validPortalOverlapComparison,
      status: "in_progress",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["status"]);
    }
  });
});
