import type { EvidenceArtifact, Finding, PortalOverlapComparison } from "@panchnama/schema";
import { describe, expect, it } from "vitest";
import {
  groupFindingsByCategory,
  overlapContextForFinding,
  publishableFindings,
  publishedEvidenceForFinding,
  toEvidenceArtifactMap,
} from "./portalDetail";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-1",
    schemaVersion: "1.0.0",
    runId: "run-1",
    portalId: "portal-1",
    ruleId: "rule.v1",
    category: "availability",
    title: "Title",
    summary: "Summary",
    severity: "advisory",
    confidence: "medium",
    checkStatus: "warning",
    reviewStatus: "reviewed",
    firstObservedAt: "2026-09-15T00:00:00Z",
    lastObservedAt: "2026-09-15T00:00:00Z",
    evidenceRefs: ["evidence-1"],
    affectedUrls: ["https://example.assam.gov.in"],
    suggestionRuleId: "suggestion.v1",
    suggestedAction: "maintain",
    limitations: [],
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: "evidence-1",
    schemaVersion: "1.0.0",
    runId: "run-1",
    portalId: "portal-1",
    type: "manual_note",
    capturedAt: "2026-09-15T00:00:00Z",
    storagePath: "evidence/e1.txt",
    contentDigest: "sha256:x",
    description: "note",
    privacyReviewed: true,
    ...overrides,
  };
}

describe("publishableFindings", () => {
  it("includes reviewed and not_assessable findings, ordered by severity", () => {
    const critical = makeFinding({ id: "f-critical", severity: "critical" });
    const advisory = makeFinding({ id: "f-advisory", severity: "advisory" });
    const notAssessable = makeFinding({
      id: "f-na",
      reviewStatus: "not_assessable",
      severity: "significant",
    });
    const result = publishableFindings({
      reviewedFindings: [advisory, critical, notAssessable],
    } as never);
    expect(result.map((f) => f.id)).toEqual(["f-critical", "f-na", "f-advisory"]);
  });

  it("excludes pending_review, automated_observation, and rejected findings", () => {
    const findings = [
      makeFinding({ id: "f-pending", reviewStatus: "pending_review" }),
      makeFinding({ id: "f-auto", reviewStatus: "automated_observation" }),
      makeFinding({ id: "f-rejected", reviewStatus: "rejected", severity: "critical" }),
      makeFinding({ id: "f-reviewed", reviewStatus: "reviewed" }),
    ];
    const result = publishableFindings({ reviewedFindings: findings } as never);
    expect(result.map((f) => f.id)).toEqual(["f-reviewed"]);
  });

  it("returns an empty array for a portal with no findings", () => {
    expect(publishableFindings({ reviewedFindings: [] } as never)).toEqual([]);
  });

  it("does not mutate the assessment's reviewedFindings array", () => {
    const findings = [
      makeFinding({ id: "a", severity: "advisory" }),
      makeFinding({ id: "b", severity: "critical" }),
    ];
    const original = [...findings];
    publishableFindings({ reviewedFindings: findings } as never);
    expect(findings).toEqual(original);
  });
});

describe("groupFindingsByCategory", () => {
  it("groups findings by category, preserving severity order within a group", () => {
    const a1 = makeFinding({ id: "a1", category: "availability", severity: "critical" });
    const a2 = makeFinding({ id: "a2", category: "availability", severity: "advisory" });
    const h1 = makeFinding({ id: "h1", category: "https", severity: "significant" });
    const groups = groupFindingsByCategory([a1, a2, h1]);
    expect([...groups.keys()]).toEqual(["availability", "https"]);
    expect(groups.get("availability")?.map((f) => f.id)).toEqual(["a1", "a2"]);
  });

  it("returns an empty map for no findings", () => {
    expect(groupFindingsByCategory([]).size).toBe(0);
  });
});

describe("publishedEvidenceForFinding / toEvidenceArtifactMap", () => {
  it("returns evidence for every ref that resolves and is privacy-reviewed", () => {
    const a = makeArtifact({ id: "e-a", privacyReviewed: true });
    const b = makeArtifact({ id: "e-b", privacyReviewed: true });
    const map = toEvidenceArtifactMap([a, b]);
    const finding = makeFinding({ evidenceRefs: ["e-a", "e-b"] });
    expect(publishedEvidenceForFinding(finding, map).map((e) => e.id)).toEqual(["e-a", "e-b"]);
  });

  it("excludes a ref whose artifact is not privacy-reviewed (rejected/unpublished evidence exclusion)", () => {
    const reviewed = makeArtifact({ id: "e-reviewed", privacyReviewed: true });
    const unreviewed = makeArtifact({ id: "e-unreviewed", privacyReviewed: false });
    const map = toEvidenceArtifactMap([reviewed, unreviewed]);
    const finding = makeFinding({ evidenceRefs: ["e-reviewed", "e-unreviewed"] });
    expect(publishedEvidenceForFinding(finding, map).map((e) => e.id)).toEqual(["e-reviewed"]);
  });

  it("silently skips a ref that doesn't resolve to any known artifact", () => {
    const map = toEvidenceArtifactMap([]);
    const finding = makeFinding({ evidenceRefs: ["e-missing"] });
    expect(publishedEvidenceForFinding(finding, map)).toEqual([]);
  });

  it("supports multiple evidence sources for a single finding", () => {
    const map = toEvidenceArtifactMap([
      makeArtifact({ id: "e-1" }),
      makeArtifact({ id: "e-2" }),
      makeArtifact({ id: "e-3" }),
    ]);
    const finding = makeFinding({ evidenceRefs: ["e-1", "e-2", "e-3"] });
    expect(publishedEvidenceForFinding(finding, map)).toHaveLength(3);
  });
});

describe("overlapContextForFinding", () => {
  const comparison: PortalOverlapComparison = {
    id: "cmp-1",
    schemaVersion: "1.0.0",
    runId: "run-1",
    portalIdA: "portal-a",
    portalIdB: "portal-b",
    status: "completed",
    reviewedAt: "2026-09-15T00:00:00Z",
    reviewer: "editor-1",
    intendedUserA: "user a",
    intendedUserB: "user b",
    serviceOrTaskA: "task a",
    serviceOrTaskB: "task b",
    linksOrRedirectsBetween: true,
    materialSimilarities: [],
    materialDifferences: [],
    conclusion: "possible_overlap",
    uncertaintyNote: "note",
    evidenceRefs: ["e-1"],
  };

  it("resolves the other portal id from either side", () => {
    const finding = makeFinding({ category: "possible_overlap", overlapComparisonId: "cmp-1" });
    expect(overlapContextForFinding(finding, [comparison], "portal-a")?.otherPortalId).toBe(
      "portal-b",
    );
    expect(overlapContextForFinding(finding, [comparison], "portal-b")?.otherPortalId).toBe(
      "portal-a",
    );
  });

  it("returns null when the finding has no overlapComparisonId", () => {
    const finding = makeFinding({ overlapComparisonId: undefined });
    expect(overlapContextForFinding(finding, [comparison], "portal-a")).toBeNull();
  });

  it("returns null when the comparison doesn't exist", () => {
    const finding = makeFinding({ overlapComparisonId: "cmp-missing" });
    expect(overlapContextForFinding(finding, [comparison], "portal-a")).toBeNull();
  });

  it("returns null when the comparison's conclusion is not possible_overlap", () => {
    const distinct = { ...comparison, id: "cmp-2", conclusion: "distinct" as const };
    const finding = makeFinding({ overlapComparisonId: "cmp-2" });
    expect(overlapContextForFinding(finding, [distinct], "portal-a")).toBeNull();
  });
});
