import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { runSourcesValidate } from "./commands/sources-validate.js";
import { runInventoryBuild } from "./commands/inventory-build.js";
import { runInventoryValidate } from "./commands/inventory-validate.js";
import { runCrawlCommand } from "./commands/crawl.js";

/**
 * `pnpm audit <command>` dispatcher — implementation.md section 9.1.
 *
 * Session 2 implemented `sources:validate`. Session 3 added
 * `inventory:build` and `inventory:validate`. Session 4 adds `crawl`.
 * Later sessions add `analyze`, `review:validate`, `publish`, `export`,
 * and `report` here.
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
  "",
  "common options: --config-dir <path> --seed-dir <path> --out-dir <path>",
];

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

    case undefined:
      return { exitCode: 1, lines: USAGE_LINES };

    default:
      return {
        exitCode: 1,
        lines: [`unknown command: "${command}"`, ...USAGE_LINES],
      };
  }
}
