import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getFixtureAuditRun,
  getFixtureEvidenceArtifacts,
  getFixtureOverlapComparisons,
  getFixturePortalAssessments,
  InvalidFixtureDataError,
} from "./publishedFixtures";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "panchnama-fixtures-"));
  tempDir = dir;
  return dir;
}

describe("getFixtureAuditRun / getFixturePortalAssessments (real repo fixtures)", () => {
  it("loads and validates the real data/fixtures/audit-run.json", () => {
    const run = getFixtureAuditRun();
    expect(run.geography).toBe("assam");
    expect(run.id).toBeTruthy();
  });

  it("loads and validates the real data/fixtures/portal-assessments.json, at least one of each health status this session's components render", () => {
    const assessments = getFixturePortalAssessments();
    expect(assessments.length).toBeGreaterThanOrEqual(2);
    const healthValues = assessments.map((a) => a.technicalHealth);
    expect(healthValues).toContain("healthy");
    expect(healthValues).toContain("degraded");
  });
});

describe("getFixtureEvidenceArtifacts / getFixtureOverlapComparisons (real repo fixtures)", () => {
  it("loads and validates the real data/fixtures/evidence-artifacts.json, including an unreviewed one for the exclusion test", () => {
    const artifacts = getFixtureEvidenceArtifacts();
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.some((a) => a.privacyReviewed === true)).toBe(true);
    expect(artifacts.some((a) => a.privacyReviewed === false)).toBe(true);
  });

  it("loads and validates the real data/fixtures/overlap-comparisons.json", () => {
    const comparisons = getFixtureOverlapComparisons();
    expect(comparisons.length).toBeGreaterThan(0);
    expect(comparisons[0]?.conclusion).toBe("possible_overlap");
  });

  it("throws InvalidFixtureDataError for malformed evidence-artifacts.json", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "evidence-artifacts.json"), JSON.stringify({ not: "an array" }));
    expect(() => getFixtureEvidenceArtifacts(dir)).toThrow(InvalidFixtureDataError);
  });
});

describe("getFixtureAuditRun (build fails loudly on invalid data)", () => {
  it("throws InvalidFixtureDataError for a schema-invalid audit run (never silently returns bad data)", () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, "audit-run.json"),
      JSON.stringify({ id: "run-1", geography: "kerala" }), // wrong literal geography
    );
    expect(() => getFixtureAuditRun(dir)).toThrow(InvalidFixtureDataError);
  });

  it("throws for malformed JSON rather than crashing with an unhandled parse error message leaking a stack trace as the only signal", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "audit-run.json"), "{not valid json");
    expect(() => getFixtureAuditRun(dir)).toThrow();
  });
});

describe("getFixturePortalAssessments (build fails loudly on invalid data)", () => {
  it("throws InvalidFixtureDataError when the file is not a JSON array", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "portal-assessments.json"), JSON.stringify({ not: "an array" }));
    expect(() => getFixturePortalAssessments(dir)).toThrow(InvalidFixtureDataError);
  });

  it("throws InvalidFixtureDataError for an entry violating the healthy/no-severe-finding invariant", () => {
    const dir = makeTempDir();
    const assessments = getFixturePortalAssessments(); // real, valid fixtures
    const broken = {
      ...assessments[0],
      technicalHealth: "healthy",
      reviewedFindings: [
        { ...assessments[1]!.reviewedFindings[0], reviewStatus: "reviewed", severity: "critical" },
      ],
    };
    writeFileSync(join(dir, "portal-assessments.json"), JSON.stringify([broken]));
    expect(() => getFixturePortalAssessments(dir)).toThrow(InvalidFixtureDataError);
  });

  it("identifies which array index failed, so a real fixture bug is easy to locate", () => {
    const dir = makeTempDir();
    const assessments = getFixturePortalAssessments();
    writeFileSync(
      join(dir, "portal-assessments.json"),
      JSON.stringify([assessments[0], { broken: true }]),
    );
    expect(() => getFixturePortalAssessments(dir)).toThrow(/index 1/);
  });
});
