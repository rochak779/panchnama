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
import type { AuditRun, LinkObservation, PageObservation } from "@panchnama/schema";
import type { SkipLogEntry } from "./frontier.js";

/**
 * Atomic write for `crawl` output — mirrors Session 3's
 * `writeInventoryBuildAtomic` convention (implementation.md section 9.2:
 * stage, validate, move; never silently overwrite a completed run). Output
 * location: `data/raw/crawl/<runId>/`, containing `manifest.json` (the
 * `AuditRun` record), `page-observations.jsonl` (one JSON object per line —
 * chosen over a single JSON array so a very large run's observations can be
 * streamed/appended without holding the whole array in memory, and so a
 * partial file is trivially detectable/truncatable), `link-observations.jsonl`
 * (Session 5, same one-record-per-line convention as page observations —
 * one `LinkObservation` per source-page/anchor occurrence of a discovered
 * destination, see `link-check.ts`'s doc comment), and `skip-log.json`
 * (every URL that was scope-excluded, robots-disallowed, or budget-cut,
 * with its reason, for coverage reporting). `data/raw/crawl/latest` holds
 * the current `runId` as plain text, matching Session 3's inventory
 * convention.
 */
export function writeCrawlRunAtomic(params: {
  outDir: string;
  runId: string;
  manifest: AuditRun;
  pageObservations: PageObservation[];
  linkObservations: LinkObservation[];
  skipLog: SkipLogEntry[];
}): { outputDir: string } {
  const finalDir = join(params.outDir, params.runId);
  if (existsSync(finalDir)) {
    throw new Error(
      `refusing to overwrite existing crawl run output at "${finalDir}" — never silently overwrite a completed run (implementation.md section 9.2). Use a different --run-id.`,
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
      join(stagingDir, "page-observations.jsonl"),
      params.pageObservations.map((o) => JSON.stringify(o)).join("\n") +
        (params.pageObservations.length > 0 ? "\n" : ""),
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "link-observations.jsonl"),
      params.linkObservations.map((o) => JSON.stringify(o)).join("\n") +
        (params.linkObservations.length > 0 ? "\n" : ""),
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "skip-log.json"),
      `${JSON.stringify(params.skipLog, null, 2)}\n`,
      "utf8",
    );

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

export function readLatestCrawlRunId(outDir: string): string | undefined {
  const latestPath = join(outDir, "latest");
  if (!existsSync(latestPath)) {
    return undefined;
  }
  return readFileSync(latestPath, "utf8").trim() || undefined;
}

/** Lists existing `assam-*` run-id directories under `outDir` (used to pick
 * the next free auto-generated run id). Never throws — an absent/unreadable
 * directory yields an empty set. */
export function listExistingCrawlRunIds(outDir: string): Set<string> {
  try {
    return new Set(
      readdirSync(outDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("assam-"))
        .map((entry) => entry.name),
    );
  } catch {
    return new Set();
  }
}
