import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  auditRunSchema,
  evidenceArtifactSchema,
  portalOverlapComparisonSchema,
  publishedPortalAssessmentSchema,
  type AuditRun,
  type EvidenceArtifact,
  type PortalOverlapComparison,
  type PublishedPortalAssessment,
} from "@panchnama/schema";

/**
 * The real, live data source — reads `data/published/current` →
 * `data/published/<runId>/*.json`, the output of `audit-cli publish`
 * (`packages/audit-cli/src/review/publish-write.ts`). This is
 * `publishedFixtures.ts`'s Session 11 promise fulfilled: "Sessions 12+
 * replace these calls with the equivalent read from real
 * `data/published/<runId>/...` output once it exists" — that output now
 * exists (Session 17/18's real Assam audit), so every page reads it here
 * instead of `data/fixtures/`.
 *
 * Same validated-parse contract as `publishedFixtures.ts`: every record is
 * checked against `@panchnama/schema` before any page reads it, and a
 * missing/invalid file throws loudly at build time rather than rendering a
 * blank or wrong page (implementation.md section 1.6 principle 1,
 * "evidence before judgment" extends to the build itself).
 *
 * `data/published/` is deliberately NOT gitignored (see `.gitignore`) —
 * unlike `data/raw/`, the published output is committed, so a normal
 * checkout always has a `current` pointer once at least one real audit has
 * been published. `resolvePublishedRunDir` still supports an env override
 * for test isolation, mirroring `PANCHNAMA_FIXTURES_DIR`.
 */

export class InvalidPublishedDataError extends Error {
  constructor(file: string, cause: unknown) {
    super(
      `${file} failed schema validation. Published audit data must be valid before any page can ` +
        `build from it — see apps/web/src/lib/publishedRun.ts.`,
    );
    this.name = "InvalidPublishedDataError";
    this.cause = cause;
  }
}

export class NoPublishedRunError extends Error {
  constructor(publishedDir: string) {
    super(
      `No published audit run found at "${publishedDir}" (no "current" pointer file). Run ` +
        `\`audit publish --run-id <id>\` first — see packages/audit-cli/src/review/publish-write.ts.`,
    );
    this.name = "NoPublishedRunError";
  }
}

function resolvePublishedDir(): string {
  return process.env.PANCHNAMA_PUBLISHED_DIR ?? join(process.cwd(), "..", "..", "data", "published");
}

/** Resolves `data/published/current` to the run directory it names.
 * Throws `NoPublishedRunError` if no run has ever been published. */
export function resolveCurrentPublishedRunDir(publishedDir: string = resolvePublishedDir()): string {
  const currentPath = join(publishedDir, "current");
  if (!existsSync(currentPath)) {
    throw new NoPublishedRunError(publishedDir);
  }
  const runId = readFileSync(currentPath, "utf8").trim();
  if (!runId) {
    throw new NoPublishedRunError(publishedDir);
  }
  return join(publishedDir, runId);
}

export function getPublishedAuditRun(publishedDir: string = resolvePublishedDir()): AuditRun {
  const runDir = resolveCurrentPublishedRunDir(publishedDir);
  const path = join(runDir, "audit-run.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const result = auditRunSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidPublishedDataError(path, result.error);
  }
  return result.data;
}

export function getPublishedPortalAssessments(
  publishedDir: string = resolvePublishedDir(),
): PublishedPortalAssessment[] {
  const runDir = resolveCurrentPublishedRunDir(publishedDir);
  const path = join(runDir, "portal-assessments.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) {
    throw new InvalidPublishedDataError(path, new Error("expected a JSON array"));
  }
  return raw.map((entry, index) => {
    const result = publishedPortalAssessmentSchema.safeParse(entry);
    if (!result.success) {
      throw new InvalidPublishedDataError(`${path} [index ${index}]`, result.error);
    }
    return result.data;
  });
}

export function getPublishedEvidenceArtifacts(
  publishedDir: string = resolvePublishedDir(),
): EvidenceArtifact[] {
  const runDir = resolveCurrentPublishedRunDir(publishedDir);
  const path = join(runDir, "evidence-artifacts.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) {
    throw new InvalidPublishedDataError(path, new Error("expected a JSON array"));
  }
  return raw.map((entry, index) => {
    const result = evidenceArtifactSchema.safeParse(entry);
    if (!result.success) {
      throw new InvalidPublishedDataError(`${path} [index ${index}]`, result.error);
    }
    return result.data;
  });
}

export function getPublishedOverlapComparisons(
  publishedDir: string = resolvePublishedDir(),
): PortalOverlapComparison[] {
  const runDir = resolveCurrentPublishedRunDir(publishedDir);
  const path = join(runDir, "overlap-comparisons.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) {
    throw new InvalidPublishedDataError(path, new Error("expected a JSON array"));
  }
  return raw.map((entry, index) => {
    const result = portalOverlapComparisonSchema.safeParse(entry);
    if (!result.success) {
      throw new InvalidPublishedDataError(`${path} [index ${index}]`, result.error);
    }
    return result.data;
  });
}
