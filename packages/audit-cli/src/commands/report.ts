import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPublishedRun } from "../review/publish-write.js";
import { buildReport } from "../review/report.js";

export interface ReportCommandParams {
  runId: string;
  publishedDir: string;
  outDir?: string;
}

export interface ReportCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

/** `pnpm run audit report --run-id <id>` — implementation.md section 9.1. */
export function runReportCommand(params: ReportCommandParams): ReportCommandOutput {
  const published = loadPublishedRun(params.publishedDir, params.runId);
  if (published === undefined) {
    return {
      exitCode: 1,
      lines: [
        `report FAILED — no published output found for run "${params.runId}" at "${join(params.publishedDir, params.runId)}". Run \`publish --run-id ${params.runId}\` first.`,
      ],
    };
  }

  const markdown = buildReport(published.assessments, published.summary);
  const outDir = params.outDir ?? join(params.publishedDir, params.runId);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "report.md");
  writeFileSync(outPath, `${markdown}\n`, "utf8");

  return {
    exitCode: 0,
    lines: [`report run: ${params.runId}`, `output: ${outPath}`, "", markdown],
  };
}
