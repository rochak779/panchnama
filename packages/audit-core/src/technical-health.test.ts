import { describe, expect, it } from "vitest";
import { deriveProvisionalTechnicalHealth } from "./technical-health.js";
import type { FindingDraft } from "./rules/types.js";

function finding(overrides: Partial<FindingDraft>): FindingDraft {
  return {
    portalId: "p1",
    ruleId: "availability.unavailable.v1",
    category: "availability",
    title: "x",
    summary: "x",
    severity: "advisory",
    confidence: "low",
    checkStatus: "fail",
    reviewStatus: "pending_review",
    firstObservedAt: "2026-08-01T00:00:00.000Z",
    lastObservedAt: "2026-08-01T00:00:00.000Z",
    affectedUrls: [],
    suggestionRuleId: "x",
    suggestedAction: "manual_assessment",
    limitations: [],
    evidence: [{ type: "text_excerpt", description: "x", content: "x" }],
    ...overrides,
  };
}

describe("deriveProvisionalTechnicalHealth", () => {
  it("is healthy with no findings", () => {
    expect(deriveProvisionalTechnicalHealth([])).toBe("healthy");
  });

  it("is healthy with only advisory findings", () => {
    expect(
      deriveProvisionalTechnicalHealth([
        finding({ severity: "advisory", ruleId: "redirect.cross-domain.v1" }),
      ]),
    ).toBe("healthy");
  });

  it("is unavailable when a critical availability.unavailable.v1 finding exists", () => {
    expect(
      deriveProvisionalTechnicalHealth([
        finding({ ruleId: "availability.unavailable.v1", severity: "critical" }),
      ]),
    ).toBe("unavailable");
  });

  it("is unavailable when a critical availability.not-found.v1 finding exists", () => {
    expect(
      deriveProvisionalTechnicalHealth([
        finding({ ruleId: "availability.not-found.v1", severity: "critical" }),
      ]),
    ).toBe("unavailable");
  });

  it("is degraded when a critical/significant non-unavailability finding exists but portal is reachable", () => {
    expect(
      deriveProvisionalTechnicalHealth([
        finding({ ruleId: "https.certificate-failure.v1", severity: "significant" }),
      ]),
    ).toBe("degraded");
  });

  it("is not_assessable when only automation-blocked/access-restricted findings exist", () => {
    expect(
      deriveProvisionalTechnicalHealth([
        finding({
          ruleId: "availability.automation-blocked.v1",
          severity: "advisory",
          checkStatus: "not_assessable",
        }),
      ]),
    ).toBe("not_assessable");
  });

  it("prefers unavailable over degraded when both signals are present", () => {
    expect(
      deriveProvisionalTechnicalHealth([
        finding({ ruleId: "availability.unavailable.v1", severity: "critical" }),
        finding({ ruleId: "https.certificate-failure.v1", severity: "significant" }),
      ]),
    ).toBe("unavailable");
  });
});
