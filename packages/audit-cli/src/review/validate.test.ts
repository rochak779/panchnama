import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SCHEMA_VERSIONS,
  evidenceArtifactSchema,
  findingSchema,
  portalOverlapComparisonSchema,
  reviewDecisionSchema,
  type EvidenceArtifact,
  type Finding,
  type PortalOverlapComparison,
  type ReviewDecision,
} from "@panchnama/schema";
import { buildAnalyzedRun, makeTestPortal, htmlPage } from "./test-helpers.js";
import { startFixtureServer } from "../crawl/testing/fixture-server.js";
import { reviewValidate } from "./validate.js";
import { writeDecisionFile } from "./decision-store.js";
import { writeEvidencePrivacyReview } from "./evidence-privacy-store.js";
import { writeOverlapComparisonFile } from "./overlap-store.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "panchnama-review-validate-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function appendJsonl(path: string, obj: unknown): void {
  writeFileSync(
    path,
    `${readFileSync(path, "utf8").replace(/\s*$/, "\n")}${JSON.stringify(obj)}\n`,
    "utf8",
  );
}

function markPublish(
  decisionsDir: string,
  findingId: string,
  overrides: Partial<ReviewDecision> = {},
): void {
  const decision: ReviewDecision = reviewDecisionSchema.parse({
    schemaVersion: SCHEMA_VERSIONS.reviewDecision,
    findingId,
    decision: "publish",
    reviewedAt: "2026-09-16T00:00:00Z",
    reviewer: "test-reviewer",
    rationale: "Confirmed via manual verification.",
    ...overrides,
  });
  writeDecisionFile(decisionsDir, decision);
}

function markPrivacyReviewed(evidencePrivacyDir: string, artifactId: string): void {
  writeEvidencePrivacyReview(evidencePrivacyDir, {
    schemaVersion: "1.0.0",
    artifactId,
    privacyReviewed: true,
    privacyReviewedAt: "2026-09-16T00:00:00Z",
    privacyReviewer: "test-reviewer",
  });
}

describe("reviewValidate", () => {
  it("reports every finding as awaiting review when no decisions exist", async () => {
    const good = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage());
    });
    try {
      const layout = await buildAnalyzedRun({
        workDir,
        portals: [makeTestPortal("good-portal", `${good.url}/`, ["127.0.0.1"])],
      });
      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.result.ok).toBe(false);
      expect(loaded.result.bundle.findings.length).toBeGreaterThan(0);
      expect(loaded.result.awaitingReview.length).toBe(loaded.result.bundle.findings.length);
      expect(loaded.result.issues.some((i) => i.code === "missing_review_decision")).toBe(true);
    } finally {
      await good.close();
    }
  });

  it("rejects a stale review reference (findingId not in this run)", async () => {
    const good = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage());
    });
    try {
      const layout = await buildAnalyzedRun({
        workDir,
        portals: [makeTestPortal("good-portal", `${good.url}/`, ["127.0.0.1"])],
      });
      markPublish(layout.reviewPaths.decisionsDir, "finding-that-does-not-exist");
      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.result.issues.some((i) => i.code === "stale_review_reference")).toBe(true);
    } finally {
      await good.close();
    }
  });

  it("gates publication on privacy-reviewed evidence; rejected/needs_more_evidence findings never become publishable", async () => {
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
    try {
      const layout = await buildAnalyzedRun({
        workDir,
        portals: [makeTestPortal("good-portal", `${good.url}/`, ["127.0.0.1"])],
      });

      const findings: Finding[] = readFileSync(
        join(layout.analysisOutDir, layout.runId, "findings.jsonl"),
        "utf8",
      )
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      expect(findings.length).toBeGreaterThan(1);

      const brokenLinkFinding = findings.find(
        (f) => f.ruleId === "broken_link.repeated-failure.v1",
      )!;
      const otherFinding = findings.find((f) => f.id !== brokenLinkFinding.id)!;

      // brokenLinkFinding: decide "publish" but do NOT privacy-review its
      // evidence -> must fail with unreviewed_evidence and never become
      // publishable.
      markPublish(layout.reviewPaths.decisionsDir, brokenLinkFinding.id);
      // otherFinding: decide "reject" -> should never be publishable
      // regardless of evidence state.
      const rejectDecision: ReviewDecision = reviewDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSIONS.reviewDecision,
        findingId: otherFinding.id,
        decision: "reject",
        reviewedAt: "2026-09-16T00:00:00Z",
        reviewer: "test-reviewer",
        rationale: "Not a real problem on manual inspection.",
      });
      writeDecisionFile(layout.reviewPaths.decisionsDir, rejectDecision);

      // Cover every remaining finding with "needs_more_evidence" so the
      // run has no missing-decision issues left to inspect the ones we
      // care about in isolation.
      for (const f of findings) {
        if (f.id === brokenLinkFinding.id || f.id === otherFinding.id) continue;
        const decision: ReviewDecision = reviewDecisionSchema.parse({
          schemaVersion: SCHEMA_VERSIONS.reviewDecision,
          findingId: f.id,
          decision: "needs_more_evidence",
          reviewedAt: "2026-09-16T00:00:00Z",
          reviewer: "test-reviewer",
          rationale: "Insufficient evidence to decide yet.",
        });
        writeDecisionFile(layout.reviewPaths.decisionsDir, decision);
      }

      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.result.awaitingReview.length).toBe(0);
      expect(loaded.result.issues.some((i) => i.code === "unreviewed_evidence")).toBe(true);
      expect(loaded.result.publishableFindingIds.has(brokenLinkFinding.id)).toBe(false);
      expect(loaded.result.publishableFindingIds.has(otherFinding.id)).toBe(false);

      // Now privacy-review brokenLinkFinding's evidence and re-validate —
      // it should become publishable, while reject/needs_more_evidence
      // findings remain excluded.
      for (const ref of brokenLinkFinding.evidenceRefs) {
        markPrivacyReviewed(layout.reviewPaths.evidencePrivacyDir, ref);
      }
      const revalidated = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(revalidated.ok).toBe(true);
      if (!revalidated.ok) return;
      expect(revalidated.result.publishableFindingIds.has(brokenLinkFinding.id)).toBe(true);
      expect(revalidated.result.publishableFindingIds.has(otherFinding.id)).toBe(false);
    } finally {
      await good.close();
      await dead.close();
    }
  });

  it("rejects a reviewer override to review_retirement on an availability-only rule's finding", async () => {
    const unreachable = { url: "http://127.0.0.1:59999" };
    const layout = await buildAnalyzedRun({
      workDir,
      portals: [makeTestPortal("unreachable-portal", `${unreachable.url}/`, ["127.0.0.1"])],
    });
    const findings: Finding[] = readFileSync(
      join(layout.analysisOutDir, layout.runId, "findings.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const unavailableFinding = findings.find((f) => f.ruleId === "availability.unavailable.v1")!;
    expect(unavailableFinding).toBeDefined();

    for (const ref of unavailableFinding.evidenceRefs) {
      markPrivacyReviewed(layout.reviewPaths.evidencePrivacyDir, ref);
    }
    markPublish(layout.reviewPaths.decisionsDir, unavailableFinding.id, {
      overriddenAction: "review_retirement",
    });
    for (const f of findings) {
      if (f.id === unavailableFinding.id) continue;
      const decision: ReviewDecision = reviewDecisionSchema.parse({
        schemaVersion: SCHEMA_VERSIONS.reviewDecision,
        findingId: f.id,
        decision: "reject",
        reviewedAt: "2026-09-16T00:00:00Z",
        reviewer: "test-reviewer",
        rationale: "out of scope for this test",
      });
      writeDecisionFile(layout.reviewPaths.decisionsDir, decision);
    }

    const loaded = reviewValidate({
      runId: layout.runId,
      analysisOutDir: layout.analysisOutDir,
      crawlOutDir: layout.crawlOutDir,
      inventoryOutDir: layout.inventoryOutDir,
      reviewPaths: layout.reviewPaths,
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(
      loaded.result.issues.some((i) => i.code === "review_retirement_from_availability_only"),
    ).toBe(true);
    expect(loaded.result.publishableFindingIds.has(unavailableFinding.id)).toBe(false);
  });

  describe("possible_overlap findings", () => {
    async function setupOverlapScenario(): Promise<{
      layout: Awaited<ReturnType<typeof buildAnalyzedRun>>;
      finding: Finding;
      evidence: EvidenceArtifact;
    }> {
      const good = await startFixtureServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(htmlPage());
      });
      const layout = await buildAnalyzedRun({
        workDir,
        portals: [
          makeTestPortal("portal-a", `${good.url}/`, ["127.0.0.1"]),
          makeTestPortal("portal-b", `${good.url}/`, ["127.0.0.1"]),
        ],
      });
      await good.close();

      const analysisDir = join(layout.analysisOutDir, layout.runId);
      const evidence: EvidenceArtifact = evidenceArtifactSchema.parse({
        id: "evidence-manual-overlap-1",
        schemaVersion: SCHEMA_VERSIONS.evidenceArtifact,
        runId: layout.runId,
        portalId: "portal-a",
        type: "manual_note",
        capturedAt: "2026-09-16T00:00:00Z",
        storagePath: `${layout.runId}/manual/evidence-manual-overlap-1.json`,
        contentDigest: "0".repeat(64),
        description: "Manual reviewer note comparing portal-a and portal-b.",
        privacyReviewed: false,
      });
      appendJsonl(join(analysisDir, "evidence-artifacts.jsonl"), evidence);

      const finding: Finding = findingSchema.parse({
        id: "finding-manual-overlap-1",
        schemaVersion: SCHEMA_VERSIONS.finding,
        runId: layout.runId,
        portalId: "portal-a",
        ruleId: "overlap.manual.v1",
        category: "possible_overlap",
        title: "Possible functional overlap with portal-b",
        summary: "Manual review flagged possible overlap; needs consolidation review.",
        severity: "advisory",
        confidence: "medium",
        checkStatus: "warning",
        reviewStatus: "pending_review",
        firstObservedAt: "2026-09-16T00:00:00Z",
        lastObservedAt: "2026-09-16T00:00:00Z",
        evidenceRefs: [evidence.id],
        affectedUrls: [],
        suggestionRuleId: "suggestion.possible-overlap.v1",
        suggestedAction: "review_consolidation",
        overlapComparisonId: "overlap-cmp-1",
        limitations: [],
      });
      appendJsonl(join(analysisDir, "findings.jsonl"), finding);

      return { layout, finding, evidence };
    }

    function baseComparison(
      overrides: Partial<PortalOverlapComparison> = {},
    ): PortalOverlapComparison {
      return portalOverlapComparisonSchema.parse({
        id: "overlap-cmp-1",
        schemaVersion: SCHEMA_VERSIONS.portalOverlapComparison,
        runId: "assam-2026-09-15-r1",
        portalIdA: "portal-a",
        portalIdB: "portal-b",
        status: "completed",
        reviewedAt: "2026-09-16T00:00:00Z",
        reviewer: "test-reviewer",
        intendedUserA: "Citizens applying for scheme A",
        intendedUserB: "Citizens applying for scheme A",
        serviceOrTaskA: "Apply for scheme A",
        serviceOrTaskB: "Apply for scheme A",
        linksOrRedirectsBetween: false,
        materialSimilarities: ["Same intended user", "Same service"],
        materialDifferences: [],
        conclusion: "possible_overlap",
        uncertaintyNote: "Both portals appear to serve the same scheme; mandate unclear.",
        evidenceRefs: ["evidence-manual-overlap-1"],
        ...overrides,
      });
    }

    it("rejects a cross-run overlap comparison", async () => {
      const { layout, finding, evidence } = await setupOverlapScenario();
      markPrivacyReviewed(layout.reviewPaths.evidencePrivacyDir, evidence.id);
      markPublish(layout.reviewPaths.decisionsDir, finding.id);
      writeOverlapComparisonFile(
        layout.reviewPaths.overlapComparisonsDir,
        baseComparison({ runId: "some-other-run" }),
      );

      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.result.issues.some((i) => i.code === "cross_run_overlap_comparison")).toBe(
        true,
      );
      expect(loaded.result.publishableFindingIds.has(finding.id)).toBe(false);
    });

    it("rejects an overlap comparison referencing a non-existent portal", async () => {
      const { layout, finding, evidence } = await setupOverlapScenario();
      markPrivacyReviewed(layout.reviewPaths.evidencePrivacyDir, evidence.id);
      markPublish(layout.reviewPaths.decisionsDir, finding.id);
      writeOverlapComparisonFile(
        layout.reviewPaths.overlapComparisonsDir,
        baseComparison({ runId: layout.runId, portalIdB: "portal-does-not-exist" }),
      );

      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.result.issues.some((i) => i.code === "overlap_portal_not_found")).toBe(true);
      expect(loaded.result.publishableFindingIds.has(finding.id)).toBe(false);
    });

    it("rejects an overlap comparison whose evidence is not privacy-reviewed", async () => {
      const { layout, finding } = await setupOverlapScenario();
      // Deliberately do NOT privacy-review the comparison's evidence.
      markPublish(layout.reviewPaths.decisionsDir, finding.id);
      writeOverlapComparisonFile(
        layout.reviewPaths.overlapComparisonsDir,
        baseComparison({ runId: layout.runId }),
      );

      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.result.issues.some((i) => i.code === "unreviewed_overlap_evidence")).toBe(true);
      expect(loaded.result.publishableFindingIds.has(finding.id)).toBe(false);
    });

    it("rejects a non-publishable overlap conclusion (distinct/insufficient_evidence)", async () => {
      const { layout, finding, evidence } = await setupOverlapScenario();
      markPrivacyReviewed(layout.reviewPaths.evidencePrivacyDir, evidence.id);
      markPublish(layout.reviewPaths.decisionsDir, finding.id);
      writeOverlapComparisonFile(
        layout.reviewPaths.overlapComparisonsDir,
        baseComparison({ runId: layout.runId, conclusion: "distinct" }),
      );

      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(
        loaded.result.issues.some((i) => i.code === "non_publishable_overlap_conclusion"),
      ).toBe(true);
      expect(loaded.result.publishableFindingIds.has(finding.id)).toBe(false);
    });

    it("accepts a fully valid, same-run, privacy-reviewed possible_overlap comparison", async () => {
      const { layout, finding, evidence } = await setupOverlapScenario();
      markPrivacyReviewed(layout.reviewPaths.evidencePrivacyDir, evidence.id);
      markPublish(layout.reviewPaths.decisionsDir, finding.id);
      writeOverlapComparisonFile(
        layout.reviewPaths.overlapComparisonsDir,
        baseComparison({ runId: layout.runId }),
      );

      const loaded = reviewValidate({
        runId: layout.runId,
        analysisOutDir: layout.analysisOutDir,
        crawlOutDir: layout.crawlOutDir,
        inventoryOutDir: layout.inventoryOutDir,
        reviewPaths: layout.reviewPaths,
      });
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.result.publishableFindingIds.has(finding.id)).toBe(true);
    });
  });
});
