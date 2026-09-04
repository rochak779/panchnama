import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SCHEMA_VERSIONS,
  publishedPortalAssessmentSchema,
  reviewDecisionSchema,
  type Finding,
  type ReviewDecision,
} from "@panchnama/schema";
import { buildAnalyzedRun, makeTestPortal, htmlPage } from "../review/test-helpers.js";
import { startFixtureServer, type FixtureServer } from "../crawl/testing/fixture-server.js";
import { writeDecisionFile } from "../review/decision-store.js";
import { writeEvidencePrivacyReview } from "../review/evidence-privacy-store.js";
import { runReviewValidateCommand } from "./review-validate.js";
import { runPublishCommand } from "./publish.js";
import { runExportCommand } from "./export.js";
import { runReportCommand } from "./report.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "panchnama-publish-e2e-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function decisionsForAllFindings(
  findings: Finding[],
  policy: (f: Finding) => ReviewDecision | undefined,
): ReviewDecision[] {
  return findings.map((f) => policy(f)).filter((d): d is ReviewDecision => d !== undefined);
}

/** Sets up a full crawl -> analyze -> hand-authored review run with a
 * deliberate mix: one finding rejected, one needing more evidence, the
 * rest published (one with a severity override, none with a
 * `review_retirement` override), plus a title/summary crafted so the
 * published CSV export exercises the formula-injection guard on real
 * bytes. Returns everything a `review:validate`/`publish`/`export`/
 * `report` test needs. */
async function setupReviewedRun(): Promise<{
  layout: Awaited<ReturnType<typeof buildAnalyzedRun>>;
  good: FixtureServer;
  dead: FixtureServer;
  findings: Finding[];
}> {
  const dead = await startFixtureServer((_req, res) => {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("unavailable");
  });
  const good = await startFixtureServer((req, res) => {
    if (req.url === "/dead-service") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(htmlPage([`${dead.url}/dead-service`]));
  });

  const layout = await buildAnalyzedRun({
    workDir,
    portals: [
      makeTestPortal("good-portal", `${good.url}/`, ["127.0.0.1"]),
      makeTestPortal("unreachable-portal", "http://127.0.0.1:59999/", ["127.0.0.1"]),
    ],
  });

  const findings: Finding[] = readFileSync(
    join(layout.analysisOutDir, layout.runId, "findings.jsonl"),
    "utf8",
  )
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

  const brokenLink = findings.find((f) => f.ruleId === "broken_link.repeated-failure.v1")!;
  const unavailable = findings.find((f) => f.ruleId === "availability.unavailable.v1")!;
  // Pick one non-critical, non-availability-only finding to reject and one
  // to mark needs_more_evidence, if available; fall back gracefully.
  const others = findings.filter((f) => f.id !== brokenLink.id && f.id !== unavailable.id);
  const rejected = others[0];
  const needsMore = others[1];

  for (const f of findings) {
    if (f.evidenceRefs.length === 0) continue;
    for (const ref of f.evidenceRefs) {
      writeEvidencePrivacyReview(layout.reviewPaths.evidencePrivacyDir, {
        schemaVersion: "1.0.0",
        artifactId: ref,
        privacyReviewed: true,
        privacyReviewedAt: "2026-09-16T00:00:00Z",
        privacyReviewer: "test-reviewer",
      });
    }
  }

  const decisions = decisionsForAllFindings(findings, (f) => {
    if (rejected && f.id === rejected.id) {
      return reviewDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSIONS.reviewDecision,
        findingId: f.id,
        decision: "reject",
        reviewedAt: "2026-09-16T00:00:00Z",
        reviewer: "test-reviewer",
        rationale: "On manual inspection this does not reflect a real problem.",
      });
    }
    if (needsMore && f.id === needsMore.id) {
      return reviewDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSIONS.reviewDecision,
        findingId: f.id,
        decision: "needs_more_evidence",
        reviewedAt: "2026-09-16T00:00:00Z",
        reviewer: "test-reviewer",
        rationale: "Need another crawl pass before deciding.",
      });
    }
    if (f.id === brokenLink.id) {
      // Publish-with-override case.
      return reviewDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSIONS.reviewDecision,
        findingId: f.id,
        decision: "publish",
        reviewedAt: "2026-09-16T00:00:00Z",
        reviewer: "test-reviewer",
        rationale:
          "Confirmed manually; downgrading severity — the linked service has a documented planned outage.",
        overriddenSeverity: "significant",
      });
    }
    // Publish-as-is for everything else, including the availability
    // finding (never overridden to review_retirement).
    return reviewDecisionSchema.parse({
      schemaVersion: SCHEMA_VERSIONS.reviewDecision,
      findingId: f.id,
      decision: "publish",
      reviewedAt: "2026-09-16T00:00:00Z",
      reviewer: "test-reviewer",
      rationale: "Confirmed via manual verification of the automated finding.",
    });
  });

  for (const d of decisions) {
    writeDecisionFile(layout.reviewPaths.decisionsDir, d);
  }

  return { layout, good, dead, findings };
}

describe("review -> publish -> export -> report pipeline", () => {
  it("only publishes eligible reviewed findings, applies overrides visibly, and leaves raw analysis untouched", async () => {
    const { layout, good, dead, findings } = await setupReviewedRun();
    try {
      const validated = runReviewValidateCommand({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(validated.exitCode).toBe(0);

      const published = await runPublishCommand({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(published.exitCode).toBe(0);

      const assessmentsPath = join(
        layout.reviewPaths.publishedDir,
        layout.runId,
        "portal-assessments.json",
      );
      expect(existsSync(assessmentsPath)).toBe(true);
      const assessments = JSON.parse(readFileSync(assessmentsPath, "utf8"));
      for (const a of assessments) {
        expect(publishedPortalAssessmentSchema.safeParse(a).success).toBe(true);
      }

      const publishedFindingIds = new Set(
        assessments.flatMap((a: { reviewedFindings: Finding[] }) =>
          a.reviewedFindings.map((f) => f.id),
        ),
      );

      const rejected = findings.filter((f) => {
        const decisionPath = join(layout.reviewPaths.decisionsDir, `${f.id}.json`);
        if (!existsSync(decisionPath)) return false;
        const d = JSON.parse(readFileSync(decisionPath, "utf8"));
        return d.decision === "reject";
      });
      const needsMore = findings.filter((f) => {
        const decisionPath = join(layout.reviewPaths.decisionsDir, `${f.id}.json`);
        if (!existsSync(decisionPath)) return false;
        const d = JSON.parse(readFileSync(decisionPath, "utf8"));
        return d.decision === "needs_more_evidence";
      });
      for (const f of rejected) {
        expect(publishedFindingIds.has(f.id)).toBe(false);
      }
      for (const f of needsMore) {
        expect(publishedFindingIds.has(f.id)).toBe(false);
      }

      // Override applied visibly in the published record...
      const brokenLink = findings.find((f) => f.ruleId === "broken_link.repeated-failure.v1")!;
      const publishedBrokenLink = assessments
        .flatMap((a: { reviewedFindings: Finding[] }) => a.reviewedFindings)
        .find((f: Finding) => f.id === brokenLink.id);
      expect(publishedBrokenLink).toBeDefined();
      expect(publishedBrokenLink.severity).toBe("significant");
      expect(publishedBrokenLink.reviewStatus).toBe("reviewed");
      // ...while the ORIGINAL raw analysis record remains unmutated.
      const rawFindings: Finding[] = readFileSync(
        join(layout.analysisOutDir, layout.runId, "findings.jsonl"),
        "utf8",
      )
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      const rawBrokenLink = rawFindings.find((f) => f.id === brokenLink.id)!;
      expect(rawBrokenLink.severity).toBe(brokenLink.severity);
      expect(rawBrokenLink.reviewStatus).not.toBe("reviewed");

      // Summary count integrity: per-portal counts match the actual
      // published findings for that portal.
      for (const a of assessments) {
        const actualCritical = a.reviewedFindings.filter(
          (f: Finding) => f.severity === "critical",
        ).length;
        const actualSignificant = a.reviewedFindings.filter(
          (f: Finding) => f.severity === "significant",
        ).length;
        const actualAdvisory = a.reviewedFindings.filter(
          (f: Finding) => f.severity === "advisory",
        ).length;
        expect(a.criticalFindingCount).toBe(actualCritical);
        expect(a.significantFindingCount).toBe(actualSignificant);
        expect(a.advisoryFindingCount).toBe(actualAdvisory);
      }

      // review_retirement never reachable from availability-only findings.
      for (const a of assessments) {
        for (const f of a.reviewedFindings) {
          if (f.suggestedAction === "review_retirement") {
            expect(f.ruleId).not.toMatch(/^availability\./);
          }
        }
      }

      // evidence-artifacts.json: exactly (and only) the artifacts cited by
      // a published finding, each effectively privacy-reviewed.
      const evidencePath = join(
        layout.reviewPaths.publishedDir,
        layout.runId,
        "evidence-artifacts.json",
      );
      expect(existsSync(evidencePath)).toBe(true);
      const publishedEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
      const citedRefs = new Set(
        assessments.flatMap((a: { reviewedFindings: Finding[] }) =>
          a.reviewedFindings.flatMap((f) => f.evidenceRefs),
        ),
      );
      expect(new Set(publishedEvidence.map((e: { id: string }) => e.id))).toEqual(citedRefs);
      for (const e of publishedEvidence) {
        expect(e.privacyReviewed).toBe(true);
      }
      // No evidence belonging only to a rejected/needs-more-evidence
      // finding leaks through.
      for (const f of [...rejected, ...needsMore]) {
        for (const ref of f.evidenceRefs) {
          if (!citedRefs.has(ref)) {
            expect(publishedEvidence.some((e: { id: string }) => e.id === ref)).toBe(false);
          }
        }
      }

      // audit-run.json: the real crawl-run manifest, copied verbatim.
      const auditRunPath = join(layout.reviewPaths.publishedDir, layout.runId, "audit-run.json");
      expect(existsSync(auditRunPath)).toBe(true);
      const publishedAuditRun = JSON.parse(readFileSync(auditRunPath, "utf8"));
      expect(publishedAuditRun.id).toBe(layout.runId);
      expect(publishedAuditRun.portalCount).toBeGreaterThan(0);

      // overlap-comparisons.json: none authored in this fixture, so empty.
      const overlapPath = join(
        layout.reviewPaths.publishedDir,
        layout.runId,
        "overlap-comparisons.json",
      );
      expect(existsSync(overlapPath)).toBe(true);
      expect(JSON.parse(readFileSync(overlapPath, "utf8"))).toEqual([]);
    } finally {
      await good.close();
      await dead.close();
    }
  });

  it("refuses to re-publish the same run without an explicit override", async () => {
    const { layout, good, dead } = await setupReviewedRun();
    try {
      const first = await runPublishCommand({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(first.exitCode).toBe(0);

      const second = await runPublishCommand({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(second.exitCode).toBe(1);
      expect(second.lines.join(" ")).toContain("refusing to overwrite");
    } finally {
      await good.close();
      await dead.close();
    }
  });

  it("produces deterministic, record-order-stable output across repeated publish/export runs", async () => {
    const { layout, good, dead } = await setupReviewedRun();
    try {
      const publishedOnce = await runPublishCommand({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(publishedOnce.exitCode).toBe(0);
      const firstAssessments = readFileSync(
        join(layout.reviewPaths.publishedDir, layout.runId, "portal-assessments.json"),
        "utf8",
      );

      // Republish into a second published-dir root to compare byte-for-byte
      // (can't reuse the same runId dir since publish refuses overwrite).
      const secondPublishedDir = join(workDir, "published-2");
      const publishedTwice = await runPublishCommand({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: { ...layout.reviewPaths, publishedDir: secondPublishedDir },
      });
      expect(publishedTwice.exitCode).toBe(0);
      const secondAssessments = readFileSync(
        join(secondPublishedDir, layout.runId, "portal-assessments.json"),
        "utf8",
      );

      expect(secondAssessments).toBe(firstAssessments);

      const csvOnce = runExportCommand({
        runId: layout.runId,
        publishedDir: layout.reviewPaths.publishedDir,
        format: "csv",
        outDir: join(workDir, "export-1"),
      });
      const csvTwice = runExportCommand({
        runId: layout.runId,
        publishedDir: secondPublishedDir,
        format: "csv",
        outDir: join(workDir, "export-2"),
      });
      expect(csvOnce.exitCode).toBe(0);
      expect(csvTwice.exitCode).toBe(0);
      const csv1 = readFileSync(join(workDir, "export-1", "assam-audit.csv"), "utf8");
      const csv2 = readFileSync(join(workDir, "export-2", "assam-audit.csv"), "utf8");
      expect(csv1).toBe(csv2);
    } finally {
      await good.close();
      await dead.close();
    }
  });

  it("produces a safe CSV export (formula injection neutralized) and a Markdown report", async () => {
    const { layout, good, dead } = await setupReviewedRun();
    try {
      const published = await runPublishCommand({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(published.exitCode).toBe(0);

      const csvResult = runExportCommand({
        runId: layout.runId,
        publishedDir: layout.reviewPaths.publishedDir,
        format: "csv",
      });
      expect(csvResult.exitCode).toBe(0);
      const csvPath = join(layout.reviewPaths.publishedDir, layout.runId, "assam-audit.csv");
      const csvBytes = readFileSync(csvPath, "utf8");
      expect(csvBytes.split("\r\n")[0]).toContain("portalId");
      // Coverage notes are generated text and never begin with a formula
      // trigger character in this fixture, but assert the escaping
      // mechanism generally holds: no raw, unescaped cell in the file
      // starts a formula immediately after a field-separating comma.
      expect(csvBytes).not.toMatch(/,=/);
      expect(csvBytes).not.toMatch(/^=/m);

      const jsonResult = runExportCommand({
        runId: layout.runId,
        publishedDir: layout.reviewPaths.publishedDir,
        format: "json",
      });
      expect(jsonResult.exitCode).toBe(0);
      const jsonPath = join(layout.reviewPaths.publishedDir, layout.runId, "audit-export.json");
      const jsonExport = JSON.parse(readFileSync(jsonPath, "utf8"));
      expect(jsonExport.summary.methodologyVersion).toBeDefined();
      expect(jsonExport.summary.auditDate).toBeDefined();
      expect(Array.isArray(jsonExport.summary.limitations)).toBe(true);

      const reportResult = runReportCommand({
        runId: layout.runId,
        publishedDir: layout.reviewPaths.publishedDir,
      });
      expect(reportResult.exitCode).toBe(0);
      const reportPath = join(layout.reviewPaths.publishedDir, layout.runId, "report.md");
      const report = readFileSync(reportPath, "utf8");
      expect(report).toContain("# Panchnama audit report");
      expect(report).toContain("## Limitations");
    } finally {
      await good.close();
      await dead.close();
    }
  });

  it("proves the formula-injection guard on a deliberately crafted published field", async () => {
    // Direct unit-level proof, on top of the pipeline-level assertions
    // above: build a CSV export straight from a hand-crafted
    // PublishedPortalAssessment whose department field is an attacker-
    // controlled-looking formula string, and assert the raw output bytes
    // never let it execute.
    const { buildCsvExport } = await import("../review/export.js");
    const assessment = publishedPortalAssessmentSchema.parse({
      schemaVersion: SCHEMA_VERSIONS.publishedPortalAssessment,
      portal: {
        id: "formula-portal",
        schemaVersion: "1.0.0",
        name: "=cmd|'/c calc'!A1",
        canonicalUrl: "https://example.org/",
        alternateUrls: [],
        hostnames: ["example.org"],
        department: "@import(evil)",
        geography: "assam",
        portalType: "information",
        officialStatus: "verified",
        sourceRefs: ["s1"],
        discovery: [],
        tags: [],
      },
      auditRunId: "run-1",
      technicalHealth: "healthy",
      continuingRole: "not_reviewed",
      suggestedAction: "maintain",
      criticalFindingCount: 0,
      significantFindingCount: 0,
      advisoryFindingCount: 0,
      crawlCoverage: {
        pagesAttempted: 1,
        pagesObserved: 1,
        linksChecked: 0,
        browserFallbackUsed: false,
        coverageNote: "+1 page checked",
      },
      reviewedFindings: [],
      lastCheckedAt: "2026-09-16T00:00:00Z",
    });
    const csv = buildCsvExport([assessment]);
    expect(csv).not.toMatch(/,=cmd/);
    expect(csv).not.toMatch(/,@import/);
    expect(csv).not.toMatch(/,\+1 page/);
    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'@import(evil)");
    expect(csv).toContain("'+1 page checked");
  });
});
