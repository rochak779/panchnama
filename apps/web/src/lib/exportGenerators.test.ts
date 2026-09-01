import { describe, expect, it } from "vitest";
import { CURRENT_METHODOLOGY_VERSION } from "./methodologyContent";
import {
  buildAuditSummaryExport,
  buildFindingsExport,
  buildMethodologyExport,
  buildPortalsExport,
} from "./exportGenerators";
import { getFixtureAuditRun, getFixturePortalAssessments } from "./publishedFixtures";
import { publishableFindings } from "./portalDetail";

describe("buildAuditSummaryExport", () => {
  it("sources every field directly from the fixture audit run, plus generatedAt", () => {
    const auditRun = getFixtureAuditRun();
    const summary = buildAuditSummaryExport(auditRun, "2026-09-16T00:00:00.000Z");
    expect(summary).toEqual({
      auditRunId: auditRun.id,
      geography: auditRun.geography,
      startedAt: auditRun.startedAt,
      completedAt: auditRun.completedAt,
      status: auditRun.status,
      methodologyVersion: auditRun.methodologyVersion,
      portalCount: auditRun.portalCount,
      portalsSucceeded: auditRun.portalsSucceeded,
      portalsFailed: auditRun.portalsFailed,
      portalsPartial: auditRun.portalsPartial,
      limitations: auditRun.limitations,
      generatedAt: "2026-09-16T00:00:00.000Z",
    });
  });
});

describe("buildPortalsExport", () => {
  it("has one entry per fixture portal assessment, sorted by portal id, identity/status fields only", () => {
    const assessments = getFixturePortalAssessments();
    const portals = buildPortalsExport(assessments);
    expect(portals).toHaveLength(assessments.length);

    const ids = portals.map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));

    const bySourceId = new Map(assessments.map((a) => [a.portal.id, a]));
    for (const portal of portals) {
      const source = bySourceId.get(portal.id);
      expect(source).toBeDefined();
      expect(portal.name).toBe(source!.portal.name);
      expect(portal.canonicalUrl).toBe(source!.portal.canonicalUrl);
      expect(portal.technicalHealth).toBe(source!.technicalHealth);
      expect(portal.criticalFindingCount).toBe(source!.criticalFindingCount);
      // No full findings array leaked into the identity/status-only export.
      expect(portal).not.toHaveProperty("reviewedFindings");
    }
  });
});

describe("buildFindingsExport", () => {
  it("contains no finding whose reviewStatus is rejected (or otherwise non-publishable)", () => {
    const assessments = getFixturePortalAssessments();
    const findings = buildFindingsExport(assessments);
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(finding.reviewStatus).not.toBe("rejected");
      expect(finding.reviewStatus).not.toBe("pending_review");
      expect(finding.reviewStatus).not.toBe("automated_observation");
    }
  });

  it("matches publishableFindings exactly, cross-checked directly", () => {
    const assessments = getFixturePortalAssessments();
    const findings = buildFindingsExport(assessments);

    const expectedCount = assessments.reduce(
      (sum, assessment) => sum + publishableFindings(assessment).length,
      0,
    );
    expect(findings).toHaveLength(expectedCount);

    for (const assessment of assessments) {
      const publishableIds = new Set(publishableFindings(assessment).map((f) => f.id));
      const exportedIdsForPortal = findings
        .filter((f) => f.portalId === assessment.portal.id)
        .map((f) => f.findingId);
      expect(new Set(exportedIdsForPortal)).toEqual(publishableIds);
    }
  });

  it("sorts by portal id then finding id", () => {
    const assessments = getFixturePortalAssessments();
    const findings = buildFindingsExport(assessments);
    const keys = findings.map((f) => `${f.portalId}::${f.findingId}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
});

describe("buildMethodologyExport", () => {
  it("version equals CURRENT_METHODOLOGY_VERSION", () => {
    const methodology = buildMethodologyExport("2026-09-16T00:00:00.000Z");
    expect(methodology.version).toBe(CURRENT_METHODOLOGY_VERSION);
    expect(methodology.generatedAt).toBe("2026-09-16T00:00:00.000Z");
  });
});

describe("regeneration determinism", () => {
  it("produces identical portals/findings/audit-summary content across two runs, excluding generatedAt", () => {
    const auditRun = getFixtureAuditRun();
    const assessments = getFixturePortalAssessments();

    const run1 = {
      summary: buildAuditSummaryExport(auditRun, "run-1-timestamp"),
      portals: buildPortalsExport(assessments),
      findings: buildFindingsExport(assessments),
    };
    const run2 = {
      summary: buildAuditSummaryExport(auditRun, "run-2-timestamp"),
      portals: buildPortalsExport(assessments),
      findings: buildFindingsExport(assessments),
    };

    const { generatedAt: _g1, ...summary1Rest } = run1.summary;
    const { generatedAt: _g2, ...summary2Rest } = run2.summary;
    expect(summary1Rest).toEqual(summary2Rest);
    expect(run1.portals).toEqual(run2.portals);
    expect(run1.findings).toEqual(run2.findings);
  });
});
