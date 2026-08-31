import { describe, expect, it } from "vitest";
import { reviewDecisionSchema } from "./review.js";
import { validReviewDecision } from "./fixtures/valid.js";

describe("reviewDecisionSchema", () => {
  it("parses a valid fixture", () => {
    expect(reviewDecisionSchema.parse(validReviewDecision)).toEqual(validReviewDecision);
  });

  it("parses a valid fixture with overrides", () => {
    const withOverrides = {
      ...validReviewDecision,
      overriddenSeverity: "advisory" as const,
      overriddenAction: "maintain" as const,
    };
    expect(reviewDecisionSchema.parse(withOverrides).overriddenSeverity).toBe("advisory");
  });

  it("rejects an invalid decision value", () => {
    const result = reviewDecisionSchema.safeParse({ ...validReviewDecision, decision: "escalate" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["decision"]);
    }
  });

  it("rejects a missing rationale", () => {
    const { rationale: _rationale, ...rest } = validReviewDecision;
    const result = reviewDecisionSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "rationale")).toBe(true);
    }
  });
});
