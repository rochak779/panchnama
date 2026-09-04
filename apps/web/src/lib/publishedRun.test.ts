import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getPublishedAuditRun,
  getPublishedEvidenceArtifacts,
  getPublishedOverlapComparisons,
  getPublishedPortalAssessments,
  InvalidPublishedDataError,
  NoPublishedRunError,
} from "./publishedRun";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function makeTempPublishedDir(runId = "test-run"): { dir: string; runDir: string } {
  const dir = mkdtempSync(join(tmpdir(), "panchnama-published-"));
  tempDir = dir;
  const runDir = join(dir, runId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(dir, "current"), `${runId}\n`);
  return { dir, runDir };
}

describe("getPublishedAuditRun / getPublishedPortalAssessments (real data/published/current)", () => {
  it("loads and validates the real published audit-run.json", () => {
    const run = getPublishedAuditRun();
    expect(run.geography).toBe("assam");
    expect(run.id).toBeTruthy();
    expect(run.portalCount).toBeGreaterThan(0);
  });

  it("loads and validates the real published portal-assessments.json", () => {
    const assessments = getPublishedPortalAssessments();
    expect(assessments.length).toBeGreaterThan(0);
    const healthValues = assessments.map((a) => a.technicalHealth);
    expect(healthValues).toContain("degraded");
  });

  it("loads and validates the real published evidence-artifacts.json, all effectively privacy-reviewed", () => {
    const artifacts = getPublishedEvidenceArtifacts();
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.every((a) => a.privacyReviewed === true)).toBe(true);
  });

  it("loads and validates the real published overlap-comparisons.json", () => {
    const comparisons = getPublishedOverlapComparisons();
    expect(Array.isArray(comparisons)).toBe(true);
  });

  it("every finding's evidenceRefs resolve into the published evidence set", () => {
    const assessments = getPublishedPortalAssessments();
    const evidenceIds = new Set(getPublishedEvidenceArtifacts().map((e) => e.id));
    for (const a of assessments) {
      for (const f of a.reviewedFindings) {
        for (const ref of f.evidenceRefs) {
          expect(evidenceIds.has(ref)).toBe(true);
        }
      }
    }
  });
});

describe("no published run yet", () => {
  it("throws NoPublishedRunError when there is no 'current' pointer file", () => {
    const dir = mkdtempSync(join(tmpdir(), "panchnama-published-empty-"));
    tempDir = dir;
    expect(() => getPublishedAuditRun(dir)).toThrow(NoPublishedRunError);
    expect(() => getPublishedPortalAssessments(dir)).toThrow(NoPublishedRunError);
  });
});

describe("build fails loudly on invalid published data", () => {
  it("throws InvalidPublishedDataError for a schema-invalid audit-run.json", () => {
    const { dir, runDir } = makeTempPublishedDir();
    writeFileSync(join(runDir, "audit-run.json"), JSON.stringify({ id: "run-1", geography: "kerala" }));
    expect(() => getPublishedAuditRun(dir)).toThrow(InvalidPublishedDataError);
  });

  it("throws InvalidPublishedDataError when portal-assessments.json is not a JSON array", () => {
    const { dir, runDir } = makeTempPublishedDir();
    writeFileSync(join(runDir, "portal-assessments.json"), JSON.stringify({ not: "an array" }));
    expect(() => getPublishedPortalAssessments(dir)).toThrow(InvalidPublishedDataError);
  });

  it("throws InvalidPublishedDataError when evidence-artifacts.json is not a JSON array", () => {
    const { dir, runDir } = makeTempPublishedDir();
    writeFileSync(join(runDir, "evidence-artifacts.json"), JSON.stringify({ not: "an array" }));
    expect(() => getPublishedEvidenceArtifacts(dir)).toThrow(InvalidPublishedDataError);
  });
});
