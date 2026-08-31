import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { EvidenceArtifact, Finding, TechnicalHealth } from "@panchnama/schema";

/**
 * Atomic write for `analyze` output — mirrors `crawl/write.ts`'s
 * established convention (implementation.md section 9.2: stage, validate,
 * then move; never silently overwrite a completed run). Output location:
 * `data/raw/analysis/<runId>/`, containing `findings.jsonl` (one `Finding`
 * per line), `evidence-artifacts.jsonl` (one newly materialized
 * `EvidenceArtifact` per line — see `materialize.ts`), `manifest.json`
 * (a small run summary: rule ids run, finding/evidence counts,
 * `checkConfigDigest`, limitations), and `provisional-technical-health.json`
 * (portal id -> PROVISIONAL, pre-review `TechnicalHealth` — see
 * `technical-health.ts`'s own doc comment for why this is explicitly not
 * the final published value). `data/raw/analysis/latest` holds the
 * current `runId` as plain text, matching the crawl/inventory convention.
 */
export interface AnalyzeManifest {
  runId: string;
  crawlRunId: string;
  inventoryRunId: string;
  analyzedAt: string;
  enabledRuleIds: string[];
  unimplementedEnabledRuleIds: string[];
  checkConfigDigest: string;
  portalCount: number;
  findingCount: number;
  evidenceArtifactCount: number;
  limitations: string[];
}

export function writeAnalysisRunAtomic(params: {
  outDir: string;
  runId: string;
  manifest: AnalyzeManifest;
  findings: Finding[];
  evidenceArtifacts: EvidenceArtifact[];
  provisionalTechnicalHealth: Record<string, TechnicalHealth>;
  overwrite?: boolean;
}): { outputDir: string } {
  const finalDir = join(params.outDir, params.runId);
  if (existsSync(finalDir) && params.overwrite !== true) {
    throw new Error(
      `refusing to overwrite existing analysis output at "${finalDir}" — never silently overwrite a completed run (implementation.md section 9.2). Use a different --run-id, or pass an explicit override.`,
    );
  }

  mkdirSync(params.outDir, { recursive: true });
  const stagingDir = mkdtempSync(join(params.outDir, ".staging-"));

  try {
    writeFileSync(
      join(stagingDir, "manifest.json"),
      `${JSON.stringify(params.manifest, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "findings.jsonl"),
      params.findings.map((f) => JSON.stringify(f)).join("\n") +
        (params.findings.length > 0 ? "\n" : ""),
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "evidence-artifacts.jsonl"),
      params.evidenceArtifacts.map((a) => JSON.stringify(a)).join("\n") +
        (params.evidenceArtifacts.length > 0 ? "\n" : ""),
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "provisional-technical-health.json"),
      `${JSON.stringify(params.provisionalTechnicalHealth, null, 2)}\n`,
      "utf8",
    );

    if (existsSync(finalDir)) {
      rmSync(finalDir, { recursive: true, force: true });
    }
    renameSync(stagingDir, finalDir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }

  const latestPath = join(params.outDir, "latest");
  const latestTmpPath = join(params.outDir, `.latest-${params.runId}.tmp`);
  writeFileSync(latestTmpPath, `${params.runId}\n`, "utf8");
  renameSync(latestTmpPath, latestPath);

  return { outputDir: finalDir };
}

export function readLatestAnalysisRunId(outDir: string): string | undefined {
  const latestPath = join(outDir, "latest");
  if (!existsSync(latestPath)) {
    return undefined;
  }
  return readFileSync(latestPath, "utf8").trim() || undefined;
}

/** Lists existing analysis run-id directories under `outDir` (used only for
 * "does this run id already have output" checks in tests). Never throws. */
export function listExistingAnalysisRunIds(outDir: string): Set<string> {
  try {
    return new Set(
      readdirSync(outDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name),
    );
  } catch {
    return new Set();
  }
}
