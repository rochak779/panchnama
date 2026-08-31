import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { runSourcesValidate } from "./commands/sources-validate.js";
import { runInventoryBuild } from "./commands/inventory-build.js";
import { runInventoryValidate } from "./commands/inventory-validate.js";

/**
 * `pnpm audit <command>` dispatcher — implementation.md section 9.1.
 *
 * Session 2 implemented `sources:validate`. Session 3 adds
 * `inventory:build` and `inventory:validate`. Later sessions add `crawl`,
 * `analyze`, `review:validate`, `publish`, `export`, and `report` here.
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

const USAGE_LINES = [
  "usage: audit <command> [options]",
  "  sources:validate",
  "  inventory:build --state assam",
  "  inventory:validate --state assam [--run-id <id>]",
  "",
  "common options: --config-dir <path> --seed-dir <path> --out-dir <path>",
];

export function runCli(argv: string[]): CliResult {
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

    case undefined:
      return { exitCode: 1, lines: USAGE_LINES };

    default:
      return {
        exitCode: 1,
        lines: [`unknown command: "${command}"`, ...USAGE_LINES],
      };
  }
}
