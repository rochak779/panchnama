import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCsvExport } from "@panchnama/audit-cli";
import {
  buildAuditSummaryExport,
  buildFindingsExport,
  buildMethodologyExport,
  buildPortalsExport,
} from "../src/lib/exportGenerators";
import { getFixtureAuditRun, getFixturePortalAssessments } from "../src/lib/publishedFixtures";

/**
 * `pnpm --filter @panchnama/web run build:exports` (run via `tsx`, the
 * same standalone-script convention `packages/database`'s
 * `src/scripts/*.ts` already uses) — a build-time generator producing the
 * full public export file set implementation.md section 10.8 requires
 * into `apps/web/public/exports/`, so Next.js serves them as static files
 * at `/exports/<filename>`.
 *
 * Deliberately a thin wrapper: every non-trivial rule (which findings are
 * publishable, how each JSON shape is built, the CSV format) lives in
 * `../src/lib/exportGenerators.ts` / `../src/lib/portalDetail.ts` /
 * `@panchnama/audit-cli`'s `buildCsvExport`, so it's unit-testable without
 * touching the filesystem. This file only reads the fixtures, calls those
 * functions, and writes the results.
 *
 * `apps/web/package.json`'s `"build"` script runs this before `next
 * build`. It intentionally throws (non-zero exit) on any failure rather
 * than writing partial output, so a broken generator fails the build
 * loudly instead of silently shipping incomplete or stale export files.
 */

const EXPORTS_DIR = join(process.cwd(), "public", "exports");

function writeJson(filename: string, data: unknown): void {
  writeFileSync(join(EXPORTS_DIR, filename), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main(): void {
  mkdirSync(EXPORTS_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const auditRun = getFixtureAuditRun();
  const assessments = getFixturePortalAssessments();

  writeJson("audit-summary.json", buildAuditSummaryExport(auditRun, generatedAt));
  writeJson("portals.json", buildPortalsExport(assessments));
  writeJson("findings.json", buildFindingsExport(assessments));
  writeJson("methodology.json", buildMethodologyExport(generatedAt));
  writeFileSync(join(EXPORTS_DIR, "assam-audit.csv"), buildCsvExport(assessments), "utf8");

  console.info(`Wrote 5 export files to ${EXPORTS_DIR}`);
}

try {
  main();
} catch (error) {
  console.error("build-exports failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
