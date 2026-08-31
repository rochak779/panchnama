import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { InventorySource, Portal } from "@panchnama/schema";
import type { BuildInventoryCandidateRecord } from "./build.js";
import { renderInventoryReport } from "./report.js";

/**
 * Atomic write: stage every output file in a temp directory, then
 * `rename` the whole staged directory into place in one filesystem
 * operation — implementation.md section 9.2 ("Write atomically: stage
 * output, validate it, then move it into place"). Never partially writes
 * `data/raw/inventory/<runId>/`: either the whole directory appears, or
 * nothing does.
 *
 * Refuses to overwrite an existing run directory (implementation.md
 * section 9.2, "Never silently overwrite a completed run") — `runId`
 * embeds a UTC build timestamp, so a collision only happens if
 * `inventory:build` is run twice within the same second, which is treated
 * as a caller error rather than something to silently clobber.
 */
export function writeInventoryBuildAtomic(params: {
  outDir: string;
  runId: string;
  nowIso: string;
  portals: Portal[];
  inventorySources: InventorySource[];
  candidates: BuildInventoryCandidateRecord[];
  warnings: string[];
}): { outputDir: string } {
  const finalDir = join(params.outDir, params.runId);
  if (existsSync(finalDir)) {
    throw new Error(
      `refusing to overwrite existing inventory build output at "${finalDir}" — never silently overwrite a completed run (implementation.md section 9.2)`,
    );
  }

  mkdirSync(params.outDir, { recursive: true });
  const stagingDir = mkdtempSync(join(params.outDir, ".staging-"));

  try {
    writeFileSync(
      join(stagingDir, "portals.json"),
      `${JSON.stringify(params.portals, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "sources.json"),
      `${JSON.stringify(params.inventorySources, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "candidates.json"),
      `${JSON.stringify(params.candidates, null, 2)}\n`,
      "utf8",
    );
    const report = renderInventoryReport({
      runId: params.runId,
      nowIso: params.nowIso,
      portals: params.portals,
      inventorySources: params.inventorySources,
      candidates: params.candidates,
      warnings: params.warnings,
    });
    writeFileSync(join(stagingDir, "report.md"), `${report}\n`, "utf8");

    renameSync(stagingDir, finalDir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }

  // Atomic pointer update: write the new "latest" content to a temp file
  // in the same directory, then rename over the old pointer.
  const latestPath = join(params.outDir, "latest");
  const latestTmpPath = join(params.outDir, `.latest-${params.runId}.tmp`);
  writeFileSync(latestTmpPath, `${params.runId}\n`, "utf8");
  renameSync(latestTmpPath, latestPath);

  return { outputDir: finalDir };
}

export function readLatestRunId(outDir: string): string | undefined {
  const latestPath = join(outDir, "latest");
  if (!existsSync(latestPath)) {
    return undefined;
  }
  return readFileSync(latestPath, "utf8").trim() || undefined;
}
