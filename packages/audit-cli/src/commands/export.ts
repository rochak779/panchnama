import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPublishedRun } from "../review/publish-write.js";
import { buildCsvExport, buildJsonExport } from "../review/export.js";

export interface ExportCommandParams {
  runId: string;
  publishedDir: string;
  format: "json" | "csv";
  /** Directory to write the export file into. Defaults to the published
   * run's own directory (`data/published/<runId>/export.<ext>`). */
  outDir?: string;
}

export interface ExportCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

/**
 * `pnpm run audit export --run-id <id> --format csv|json` —
 * implementation.md section 9.1. Reads only from the already-PUBLISHED
 * dataset at `data/published/<runId>/` (never raw/candidate data) —
 * "the frontend must never read unfinished raw crawl output directly"
 * (section 4.4) applies equally to this export. JSON is the default
 * format when `--format` is omitted (documented choice: JSON is the
 * lossless, structurally complete representation; CSV is the
 * analysis-friendly flattened derivative).
 */
export function runExportCommand(params: ExportCommandParams): ExportCommandOutput {
  const published = loadPublishedRun(params.publishedDir, params.runId);
  if (published === undefined) {
    return {
      exitCode: 1,
      lines: [
        `export FAILED — no published output found for run "${params.runId}" at "${join(params.publishedDir, params.runId)}". Run \`publish --run-id ${params.runId}\` first.`,
      ],
    };
  }

  const content =
    params.format === "csv"
      ? buildCsvExport(published.assessments)
      : buildJsonExport(published.assessments, published.summary);
  const fileName = params.format === "csv" ? "assam-audit.csv" : "audit-export.json";
  const outDir = params.outDir ?? join(params.publishedDir, params.runId);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, fileName);
  writeFileSync(outPath, content, "utf8");

  return {
    exitCode: 0,
    lines: [
      `export run: ${params.runId}`,
      `format: ${params.format}`,
      `portals exported: ${published.assessments.length}`,
      `output: ${outPath}`,
    ],
  };
}
