import type { Finding, PublishedPortalAssessment } from "@panchnama/schema";
import { describe, expect, it } from "vitest";
import {
  countByTechnicalHealth,
  countBySeverity,
  countBySuggestedAction,
  directoryMismatchFindings,
  notAssessablePortals,
  topPriorityFindings,
} from "./overviewSummary";

const baseFinding: Finding = {
  id: "finding-availability-0001",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalId: "portal-agri-farmers-welfare",
  ruleId: "availability.unavailable.v1",
  category: "availability",
  title: "Portal entry point unavailable",
  summary: "Unavailable during three checks on 2026-09-14 and 2026-09-15.",
  severity: "significant",
  confidence: "high",
  checkStatus: "fail",
  reviewStatus: "reviewed",
  firstObservedAt: "2026-09-14T02:00:00Z",
  lastObservedAt: "2026-09-15T02:10:00Z",
  evidenceRefs: ["evidence-http-0001"],
  affectedUrls: ["https://farmerswelfare.assam.gov.in"],
  suggestionRuleId: "suggestion.repair.v1",
  suggestedAction: "repair",
  reviewerRationale: "Confirmed across three spaced attempts; not a bot block.",
  limitations: ["Single-region vantage point."],
};

const baseAssessment: PublishedPortalAssessment = {
  schemaVersion: "1.0.0",
  portal: {
    id: "portal-agri-farmers-welfare",
    schemaVersion: "1.0.0",
    name: "Assam Farmers Welfare Portal",
    canonicalUrl: "https://farmerswelfare.assam.gov.in",
    alternateUrls: [],
    hostnames: ["farmerswelfare.assam.gov.in"],
    department: "Department of Agriculture",
    geography: "assam",
    portalType: "transactional",
    officialStatus: "verified",
    sourceRefs: ["src-assam-directory-2026"],
    discovery: [
      {
        discoveredAt: "2026-08-01T06:06:00Z",
        discoveredFromUrl: "https://assam.gov.in/directory",
        discoveryMethod: "listed",
      },
    ],
    tags: ["agriculture"],
  },
  auditRunId: "assam-2026-09-15-r1",
  technicalHealth: "degraded",
  continuingRole: "possible_overlap",
  suggestedAction: "repair",
  criticalFindingCount: 0,
  significantFindingCount: 1,
  advisoryFindingCount: 0,
  crawlCoverage: {
    pagesAttempted: 5,
    pagesObserved: 3,
    linksChecked: 12,
    browserFallbackUsed: false,
    coverageNote: "Homepage and two linked pages observed before repeated failure.",
  },
  reviewedFindings: [baseFinding],
  lastCheckedAt: "2026-09-15T02:10:00Z",
};

function assessment(overrides: Partial<PublishedPortalAssessment>): PublishedPortalAssessment {
  return { ...baseAssessment, ...overrides };
}

function finding(overrides: Partial<Finding>): Finding {
  return { ...baseFinding, ...overrides };
}

describe("countByTechnicalHealth", () => {
  it("counts every technical health value, including zero-count keys", () => {
    const counts = countByTechnicalHealth([
      assessment({ technicalHealth: "healthy" }),
      assessment({ technicalHealth: "healthy" }),
      assessment({ technicalHealth: "degraded" }),
    ]);
    expect(counts).toEqual({ healthy: 2, degraded: 1, unavailable: 0, not_assessable: 0 });
  });

  it("returns all-zero counts for an empty dataset (no-findings/no-portals case)", () => {
    expect(countByTechnicalHealth([])).toEqual({
      healthy: 0,
      degraded: 0,
      unavailable: 0,
      not_assessable: 0,
    });
  });
});

describe("countBySeverity", () => {
  it("sums each assessment's own per-severity finding counts", () => {
    const counts = countBySeverity([
      assessment({ criticalFindingCount: 1, significantFindingCount: 2, advisoryFindingCount: 0 }),
      assessment({ criticalFindingCount: 0, significantFindingCount: 1, advisoryFindingCount: 3 }),
    ]);
    expect(counts).toEqual({ critical: 1, significant: 3, advisory: 3 });
  });
});

describe("countBySuggestedAction", () => {
  it("counts each assessment's overall suggestedAction", () => {
    const counts = countBySuggestedAction([
      assessment({ suggestedAction: "repair" }),
      assessment({ suggestedAction: "repair" }),
      assessment({ suggestedAction: "maintain" }),
    ]);
    expect(counts.repair).toBe(2);
    expect(counts.maintain).toBe(1);
    expect(counts.review_consolidation).toBe(0);
  });
});

describe("topPriorityFindings", () => {
  it("orders critical before significant before advisory", () => {
    const advisory = finding({ id: "f-advisory", severity: "advisory" });
    const critical = finding({ id: "f-critical", severity: "critical" });
    const significant = finding({ id: "f-significant", severity: "significant" });
    const result = topPriorityFindings([
      assessment({ reviewedFindings: [advisory, critical, significant] }),
    ]);
    expect(result.map((r) => r.finding.id)).toEqual(["f-critical", "f-significant", "f-advisory"]);
  });

  it("excludes findings that are not yet reviewed", () => {
    const pending = finding({ id: "f-pending", reviewStatus: "pending_review" });
    const result = topPriorityFindings([assessment({ reviewedFindings: [pending] })]);
    expect(result).toEqual([]);
  });

  it("respects the limit", () => {
    const findings = Array.from({ length: 8 }, (_, i) => finding({ id: `f-${i}` }));
    const result = topPriorityFindings([assessment({ reviewedFindings: findings })], 3);
    expect(result).toHaveLength(3);
  });

  it("returns an empty array for a no-findings dataset", () => {
    expect(topPriorityFindings([assessment({ reviewedFindings: [] })])).toEqual([]);
  });

  it("carries the portal id and name alongside each finding", () => {
    const [result] = topPriorityFindings([assessment({})]);
    expect(result?.portalId).toBe(baseAssessment.portal.id);
    expect(result?.portalName).toBe(baseAssessment.portal.name);
  });
});

describe("directoryMismatchFindings", () => {
  it("returns only reviewed directory_mismatch findings", () => {
    const mismatch = finding({ id: "f-mismatch", category: "directory_mismatch" });
    const other = finding({ id: "f-other", category: "availability" });
    const result = directoryMismatchFindings([assessment({ reviewedFindings: [mismatch, other] })]);
    expect(result.map((r) => r.finding.id)).toEqual(["f-mismatch"]);
  });

  it("returns an empty array when there are none", () => {
    expect(directoryMismatchFindings([assessment({ reviewedFindings: [] })])).toEqual([]);
  });
});

describe("notAssessablePortals", () => {
  it("lists not_assessable portals with their coverage note", () => {
    const result = notAssessablePortals([
      assessment({
        technicalHealth: "not_assessable",
        crawlCoverage: {
          pagesAttempted: 1,
          pagesObserved: 0,
          linksChecked: 0,
          browserFallbackUsed: false,
          coverageNote: "Blocked by a CAPTCHA challenge.",
        },
      }),
      assessment({ technicalHealth: "healthy" }),
    ]);
    expect(result).toEqual([
      {
        portalId: baseAssessment.portal.id,
        portalName: baseAssessment.portal.name,
        coverageNote: "Blocked by a CAPTCHA challenge.",
      },
    ]);
  });

  it("returns an empty array when every portal was assessable", () => {
    expect(notAssessablePortals([assessment({ technicalHealth: "healthy" })])).toEqual([]);
  });
});
