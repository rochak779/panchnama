import { describe, expect, it } from "vitest";
import { publishedPortalAssessmentSchema } from "./published-assessment.js";
import { validFindingAvailability, validPublishedPortalAssessment } from "./fixtures/valid.js";

describe("publishedPortalAssessmentSchema", () => {
  it("parses a valid fixture", () => {
    expect(publishedPortalAssessmentSchema.parse(validPublishedPortalAssessment)).toEqual(
      validPublishedPortalAssessment,
    );
  });

  it("rejects technicalHealth 'healthy' when a reviewed significant finding is present", () => {
    const result = publishedPortalAssessmentSchema.safeParse({
      ...validPublishedPortalAssessment,
      technicalHealth: "healthy",
      reviewedFindings: [validFindingAvailability], // severity: significant, reviewStatus: reviewed
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "technicalHealth")).toBe(true);
    }
  });

  it("allows technicalHealth 'healthy' when findings are not reviewed-critical/significant", () => {
    const pendingFinding = { ...validFindingAvailability, reviewStatus: "pending_review" as const };
    const assessment = {
      ...validPublishedPortalAssessment,
      technicalHealth: "healthy" as const,
      reviewedFindings: [pendingFinding],
    };
    expect(publishedPortalAssessmentSchema.parse(assessment).technicalHealth).toBe("healthy");
  });

  it("allows technicalHealth 'healthy' with no findings at all", () => {
    const assessment = {
      ...validPublishedPortalAssessment,
      technicalHealth: "healthy" as const,
      reviewedFindings: [],
    };
    expect(publishedPortalAssessmentSchema.parse(assessment).technicalHealth).toBe("healthy");
  });

  it("rejects technicalHealth 'not_assessable' with an empty coverageNote", () => {
    const result = publishedPortalAssessmentSchema.safeParse({
      ...validPublishedPortalAssessment,
      technicalHealth: "not_assessable",
      crawlCoverage: { ...validPublishedPortalAssessment.crawlCoverage, coverageNote: "   " },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join(".") === "crawlCoverage.coverageNote"),
      ).toBe(true);
    }
  });

  it("rejects an invalid nested portal (propagates the nested error path)", () => {
    const result = publishedPortalAssessmentSchema.safeParse({
      ...validPublishedPortalAssessment,
      portal: { ...validPublishedPortalAssessment.portal, geography: "delhi" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "portal.geography")).toBe(true);
    }
  });
});
