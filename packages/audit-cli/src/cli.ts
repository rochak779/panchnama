import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { runSourcesValidate } from "./commands/sources-validate.js";
import { runInventoryBuild } from "./commands/inventory-build.js";
import { runInventoryValidate } from "./commands/inventory-validate.js";
import { runCrawlCommand } from "./commands/crawl.js";
import { runAnalyzeCommand } from "./commands/analyze.js";
import { runAnalyzeFixture } from "./analyze/fixture.js";
import { runReviewValidateCommand } from "./commands/review-validate.js";
import { runReviewScaffoldCommand } from "./commands/review-scaffold.js";
import { runPublishCommand } from "./commands/publish.js";
import { runExportCommand } from "./commands/export.js";
import { runReportCommand } from "./commands/report.js";
import { reviewPaths } from "./review/paths.js";
import type { Severity, SuggestedAction } from "@panchnama/schema";

/**
 * `pnpm audit <command>` dispatcher — implementation.md section 9.1.
 *
 * Session 2 implemented `sources:validate`. Session 3 added
 * `inventory:build` and `inventory:validate`. Session 4 adds `crawl`.
 * Session 7 adds `analyze`. Session 8 adds `review:validate`,
 * `review:scaffold`, `publish`, `export`, and `report`.
 */

/** Repo-root directory, resolved relative to this module's own location
 * (not `process.cwd()`), so commands work the same whether invoked via
 * `pnpm audit ...`, `pnpm --filter @panchnama/audit-cli run start ...`, or
 * directly with `node dist/bin.js` from any cwd. */
function repoRootDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli.js -> dist -> packages/audit-cli -> packages -> repo root
  return join(here, "..", "..", "..");
}

function defaultRepoConfigDir(): string {
  return join(repoRootDir(), "config");
}

function defaultSeedDir(): string {
  return join(repoRootDir(), "data", "seed");
}

function defaultInventoryOutDir(): string {
  return join(repoRootDir(), "data", "raw", "inventory");
}

function defaultCrawlOutDir(): string {
  return join(repoRootDir(), "data", "raw", "crawl");
}

function defaultAnalysisOutDir(): string {
  return join(repoRootDir(), "data", "raw", "analysis");
}

function defaultEvidenceOutDir(): string {
  return join(repoRootDir(), "data", "evidence");
}

function defaultPublishedDir(): string {
  return join(repoRootDir(), "data", "published");
}

export interface CliResult {
  exitCode: 0 | 1;
  lines: string[];
}

/** Finds `--<name> <value>` in `argv` and returns the value, or `undefined`
 * if the flag is absent. Returns a one-line usage error string instead of
 * a value if the flag is present but missing its argument. */
function readFlag(argv: string[], name: string): { value: string | undefined; error?: string } {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) {
    return { value: undefined };
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    return { value: undefined, error: `--${name} requires a value` };
  }
  return { value };
}

/** Finds a boolean `--<name>` flag (no value) in `argv`. */
function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

const USAGE_LINES = [
  "usage: audit <command> [options]",
  "  sources:validate",
  "  inventory:build --state assam",
  "  inventory:validate --state assam [--run-id <id>]",
  "  crawl --state assam [--run-id <id>] [--dry-run]",
  "  crawl --portal <portal-id> [--max-pages <n>] [--dry-run]",
  "  analyze --run-id <id> [--inventory-run-id <id>] [--force]",
  "  analyze --portal <portal-id> --fixture",
  "  review:validate --run-id <id>",
  "  review:scaffold --run-id <id> --finding-id <id> --decision <publish|reject|needs_more_evidence> --reviewer <name> [--rationale <text>] [--overridden-severity <s>] [--overridden-action <a>] [--force]",
  "  publish --run-id <id> [--force]",
  "  export --run-id <id> [--format json|csv] [--out-dir <path>]",
  "  report --run-id <id> [--out-dir <path>]",
  "",
  "common options: --config-dir <path> --seed-dir <path> --out-dir <path>",
];

function resolveReviewPaths(rest: string[]): {
  paths: ReturnType<typeof reviewPaths>;
  error?: string;
} {
  const reviewDirFlag = readFlag(rest, "review-dir");
  if (reviewDirFlag.error) {
    return { paths: reviewPaths(repoRootDir()), error: reviewDirFlag.error };
  }
  if (reviewDirFlag.value === undefined) {
    return { paths: reviewPaths(repoRootDir()) };
  }
  const root = resolve(reviewDirFlag.value);
  return {
    paths: {
      reviewDir: root,
      decisionsDir: join(root, "decisions"),
      evidencePrivacyDir: join(root, "evidence-privacy"),
      overlapComparisonsDir: join(root, "overlap-comparisons"),
      publishedDir: defaultPublishedDir(),
    },
  };
}

export async function runCli(argv: string[]): Promise<CliResult> {
  const [command, ...rest] = argv;

  const configDirFlag = readFlag(rest, "config-dir");
  if (configDirFlag.error) {
    return { exitCode: 1, lines: [configDirFlag.error] };
  }
  const configDir =
    configDirFlag.value !== undefined ? resolve(configDirFlag.value) : defaultRepoConfigDir();

  switch (command) {
    case "sources:validate":
      return runSourcesValidate(configDir);

    case "inventory:build": {
      const stateFlag = readFlag(rest, "state");
      if (stateFlag.error) {
        return { exitCode: 1, lines: [stateFlag.error] };
      }
      if (stateFlag.value !== "assam") {
        return {
          exitCode: 1,
          lines: ["inventory:build requires --state assam (only geography currently supported)"],
        };
      }
      const seedDirFlag = readFlag(rest, "seed-dir");
      if (seedDirFlag.error) {
        return { exitCode: 1, lines: [seedDirFlag.error] };
      }
      const outDirFlag = readFlag(rest, "out-dir");
      if (outDirFlag.error) {
        return { exitCode: 1, lines: [outDirFlag.error] };
      }
      return runInventoryBuild({
        configDir,
        seedDir: seedDirFlag.value !== undefined ? resolve(seedDirFlag.value) : defaultSeedDir(),
        outDir:
          outDirFlag.value !== undefined ? resolve(outDirFlag.value) : defaultInventoryOutDir(),
      });
    }

    case "inventory:validate": {
      const stateFlag = readFlag(rest, "state");
      if (stateFlag.error) {
        return { exitCode: 1, lines: [stateFlag.error] };
      }
      if (stateFlag.value !== "assam") {
        return {
          exitCode: 1,
          lines: ["inventory:validate requires --state assam (only geography currently supported)"],
        };
      }
      const outDirFlag = readFlag(rest, "out-dir");
      if (outDirFlag.error) {
        return { exitCode: 1, lines: [outDirFlag.error] };
      }
      const runIdFlag = readFlag(rest, "run-id");
      if (runIdFlag.error) {
        return { exitCode: 1, lines: [runIdFlag.error] };
      }
      return runInventoryValidate({
        outDir:
          outDirFlag.value !== undefined ? resolve(outDirFlag.value) : defaultInventoryOutDir(),
        ...(runIdFlag.value !== undefined ? { runId: runIdFlag.value } : {}),
      });
    }

    case "crawl": {
      const stateFlag = readFlag(rest, "state");
      const portalFlag = readFlag(rest, "portal");
      if (stateFlag.error) {
        return { exitCode: 1, lines: [stateFlag.error] };
      }
      if (portalFlag.error) {
        return { exitCode: 1, lines: [portalFlag.error] };
      }
      if (stateFlag.value === undefined && portalFlag.value === undefined) {
        return {
          exitCode: 1,
          lines: [
            "crawl requires --state assam (full run) or --portal <portal-id> (scoped dev run)",
          ],
        };
      }
      if (stateFlag.value !== undefined && stateFlag.value !== "assam") {
        return {
          exitCode: 1,
          lines: ["crawl requires --state assam (only geography currently supported)"],
        };
      }

      const runIdFlag = readFlag(rest, "run-id");
      const inventoryRunIdFlag = readFlag(rest, "inventory-run-id");
      const inventoryOutDirFlag = readFlag(rest, "inventory-out-dir");
      const crawlOutDirFlag = readFlag(rest, "out-dir");
      const maxPagesFlag = readFlag(rest, "max-pages");
      for (const flag of [
        runIdFlag,
        inventoryRunIdFlag,
        inventoryOutDirFlag,
        crawlOutDirFlag,
        maxPagesFlag,
      ]) {
        if (flag.error) {
          return { exitCode: 1, lines: [flag.error] };
        }
      }
      let maxPagesOverride: number | undefined;
      if (maxPagesFlag.value !== undefined) {
        const parsed = Number.parseInt(maxPagesFlag.value, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return { exitCode: 1, lines: ["--max-pages must be a positive integer"] };
        }
        maxPagesOverride = parsed;
      }

      const result = await runCrawlCommand({
        configDir,
        inventoryOutDir:
          inventoryOutDirFlag.value !== undefined
            ? resolve(inventoryOutDirFlag.value)
            : defaultInventoryOutDir(),
        crawlOutDir:
          crawlOutDirFlag.value !== undefined
            ? resolve(crawlOutDirFlag.value)
            : defaultCrawlOutDir(),
        repoRoot: repoRootDir(),
        ...(runIdFlag.value !== undefined ? { runId: runIdFlag.value } : {}),
        ...(inventoryRunIdFlag.value !== undefined
          ? { inventoryRunId: inventoryRunIdFlag.value }
          : {}),
        ...(portalFlag.value !== undefined ? { portalId: portalFlag.value } : {}),
        ...(maxPagesOverride !== undefined ? { maxPagesOverride } : {}),
        dryRun: hasFlag(rest, "dry-run"),
      });
      return result;
    }

    case "analyze": {
      const portalFlag = readFlag(rest, "portal");
      const fixtureFlag = hasFlag(rest, "fixture");
      if (portalFlag.error) {
        return { exitCode: 1, lines: [portalFlag.error] };
      }

      if (fixtureFlag) {
        if (portalFlag.value === undefined) {
          return { exitCode: 1, lines: ["analyze --fixture requires --portal <portal-id>"] };
        }
        return runAnalyzeFixture({ configDir, portalId: portalFlag.value });
      }

      const runIdFlag = readFlag(rest, "run-id");
      const inventoryRunIdFlag = readFlag(rest, "inventory-run-id");
      const crawlOutDirFlag = readFlag(rest, "crawl-out-dir");
      const inventoryOutDirFlag = readFlag(rest, "inventory-out-dir");
      const analysisOutDirFlag = readFlag(rest, "out-dir");
      const evidenceOutDirFlag = readFlag(rest, "evidence-out-dir");
      for (const flag of [
        runIdFlag,
        inventoryRunIdFlag,
        crawlOutDirFlag,
        inventoryOutDirFlag,
        analysisOutDirFlag,
        evidenceOutDirFlag,
      ]) {
        if (flag.error) {
          return { exitCode: 1, lines: [flag.error] };
        }
      }

      return runAnalyzeCommand({
        configDir,
        crawlOutDir:
          crawlOutDirFlag.value !== undefined
            ? resolve(crawlOutDirFlag.value)
            : defaultCrawlOutDir(),
        inventoryOutDir:
          inventoryOutDirFlag.value !== undefined
            ? resolve(inventoryOutDirFlag.value)
            : defaultInventoryOutDir(),
        analysisOutDir:
          analysisOutDirFlag.value !== undefined
            ? resolve(analysisOutDirFlag.value)
            : defaultAnalysisOutDir(),
        evidenceOutDir:
          evidenceOutDirFlag.value !== undefined
            ? resolve(evidenceOutDirFlag.value)
            : defaultEvidenceOutDir(),
        ...(runIdFlag.value !== undefined ? { runId: runIdFlag.value } : {}),
        ...(inventoryRunIdFlag.value !== undefined
          ? { inventoryRunId: inventoryRunIdFlag.value }
          : {}),
        overwrite: hasFlag(rest, "force"),
      });
    }

    case "review:validate": {
      const runIdFlag = readFlag(rest, "run-id");
      if (runIdFlag.error) return { exitCode: 1, lines: [runIdFlag.error] };
      if (runIdFlag.value === undefined) {
        return { exitCode: 1, lines: ["review:validate requires --run-id <id>"] };
      }
      const crawlOutDirFlag = readFlag(rest, "crawl-out-dir");
      const inventoryOutDirFlag = readFlag(rest, "inventory-out-dir");
      const analysisOutDirFlag = readFlag(rest, "analysis-out-dir");
      for (const flag of [crawlOutDirFlag, inventoryOutDirFlag, analysisOutDirFlag]) {
        if (flag.error) return { exitCode: 1, lines: [flag.error] };
      }
      const { paths: paths1, error: reviewDirError1 } = resolveReviewPaths(rest);
      if (reviewDirError1) return { exitCode: 1, lines: [reviewDirError1] };

      return runReviewValidateCommand({
        runId: runIdFlag.value,
        analysisOutDir:
          analysisOutDirFlag.value !== undefined
            ? resolve(analysisOutDirFlag.value)
            : defaultAnalysisOutDir(),
        crawlOutDir:
          crawlOutDirFlag.value !== undefined
            ? resolve(crawlOutDirFlag.value)
            : defaultCrawlOutDir(),
        inventoryOutDir:
          inventoryOutDirFlag.value !== undefined
            ? resolve(inventoryOutDirFlag.value)
            : defaultInventoryOutDir(),
        reviewPaths: paths1,
      });
    }

    case "review:scaffold": {
      const runIdFlag = readFlag(rest, "run-id");
      const findingIdFlag = readFlag(rest, "finding-id");
      const decisionFlag = readFlag(rest, "decision");
      const reviewerFlag = readFlag(rest, "reviewer");
      const rationaleFlag = readFlag(rest, "rationale");
      const overriddenSeverityFlag = readFlag(rest, "overridden-severity");
      const overriddenActionFlag = readFlag(rest, "overridden-action");
      for (const flag of [
        runIdFlag,
        findingIdFlag,
        decisionFlag,
        reviewerFlag,
        rationaleFlag,
        overriddenSeverityFlag,
        overriddenActionFlag,
      ]) {
        if (flag.error) return { exitCode: 1, lines: [flag.error] };
      }
      if (
        runIdFlag.value === undefined ||
        findingIdFlag.value === undefined ||
        decisionFlag.value === undefined ||
        reviewerFlag.value === undefined
      ) {
        return {
          exitCode: 1,
          lines: [
            "review:scaffold requires --run-id <id> --finding-id <id> --decision <publish|reject|needs_more_evidence> --reviewer <name>",
          ],
        };
      }
      if (!["publish", "reject", "needs_more_evidence"].includes(decisionFlag.value)) {
        return {
          exitCode: 1,
          lines: ['--decision must be one of "publish", "reject", "needs_more_evidence"'],
        };
      }
      const { paths: paths2, error: reviewDirError2 } = resolveReviewPaths(rest);
      if (reviewDirError2) return { exitCode: 1, lines: [reviewDirError2] };

      return runReviewScaffoldCommand({
        runId: runIdFlag.value,
        findingId: findingIdFlag.value,
        analysisOutDir: defaultAnalysisOutDir(),
        crawlOutDir: defaultCrawlOutDir(),
        inventoryOutDir: defaultInventoryOutDir(),
        reviewPaths: paths2,
        decision: decisionFlag.value as "publish" | "reject" | "needs_more_evidence",
        reviewer: reviewerFlag.value,
        ...(rationaleFlag.value !== undefined ? { rationale: rationaleFlag.value } : {}),
        ...(overriddenSeverityFlag.value !== undefined
          ? { overriddenSeverity: overriddenSeverityFlag.value as Severity }
          : {}),
        ...(overriddenActionFlag.value !== undefined
          ? { overriddenAction: overriddenActionFlag.value as SuggestedAction }
          : {}),
        overwrite: hasFlag(rest, "force"),
      });
    }

    case "publish": {
      const runIdFlag = readFlag(rest, "run-id");
      if (runIdFlag.error) return { exitCode: 1, lines: [runIdFlag.error] };
      if (runIdFlag.value === undefined) {
        return { exitCode: 1, lines: ["publish requires --run-id <id>"] };
      }
      const { paths: paths3, error: reviewDirError3 } = resolveReviewPaths(rest);
      if (reviewDirError3) return { exitCode: 1, lines: [reviewDirError3] };

      return runPublishCommand({
        runId: runIdFlag.value,
        analysisOutDir: defaultAnalysisOutDir(),
        crawlOutDir: defaultCrawlOutDir(),
        inventoryOutDir: defaultInventoryOutDir(),
        reviewPaths: paths3,
        overwrite: hasFlag(rest, "force"),
      });
    }

    case "export": {
      const runIdFlag = readFlag(rest, "run-id");
      const formatFlag = readFlag(rest, "format");
      const outDirFlag = readFlag(rest, "out-dir");
      for (const flag of [runIdFlag, formatFlag, outDirFlag]) {
        if (flag.error) return { exitCode: 1, lines: [flag.error] };
      }
      if (runIdFlag.value === undefined) {
        return { exitCode: 1, lines: ["export requires --run-id <id>"] };
      }
      const format = formatFlag.value ?? "json";
      if (format !== "json" && format !== "csv") {
        return { exitCode: 1, lines: ['--format must be "json" or "csv"'] };
      }
      return runExportCommand({
        runId: runIdFlag.value,
        publishedDir: defaultPublishedDir(),
        format,
        ...(outDirFlag.value !== undefined ? { outDir: resolve(outDirFlag.value) } : {}),
      });
    }

    case "report": {
      const runIdFlag = readFlag(rest, "run-id");
      const outDirFlag = readFlag(rest, "out-dir");
      for (const flag of [runIdFlag, outDirFlag]) {
        if (flag.error) return { exitCode: 1, lines: [flag.error] };
      }
      if (runIdFlag.value === undefined) {
        return { exitCode: 1, lines: ["report requires --run-id <id>"] };
      }
      return runReportCommand({
        runId: runIdFlag.value,
        publishedDir: defaultPublishedDir(),
        ...(outDirFlag.value !== undefined ? { outDir: resolve(outDirFlag.value) } : {}),
      });
    }

    case undefined:
      return { exitCode: 1, lines: USAGE_LINES };

    default:
      return {
        exitCode: 1,
        lines: [`unknown command: "${command}"`, ...USAGE_LINES],
      };
  }
}
