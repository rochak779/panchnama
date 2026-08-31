import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { runSourcesValidate } from "./commands/sources-validate.js";

/**
 * `pnpm audit <command>` dispatcher — implementation.md section 9.1.
 *
 * This session implements only `sources:validate`. Later sessions add
 * `inventory:build`, `inventory:validate`, `crawl`, `analyze`,
 * `review:validate`, `publish`, `export`, and `report` here.
 */

/** Repo-root `config/` directory, resolved relative to this module's own
 * location (not `process.cwd()`), so the command works the same whether
 * invoked via `pnpm audit ...`, `pnpm --filter @panchnama/audit-cli run
 * start ...`, or directly with `node dist/bin.js` from any cwd. */
function defaultRepoConfigDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli.js -> dist -> packages/audit-cli -> packages -> repo root
  return join(here, "..", "..", "..", "config");
}

export interface CliResult {
  exitCode: 0 | 1;
  lines: string[];
}

export function runCli(argv: string[]): CliResult {
  const [command, ...rest] = argv;

  let configDir = defaultRepoConfigDir();
  const configDirFlagIndex = rest.indexOf("--config-dir");
  if (configDirFlagIndex !== -1) {
    const value = rest[configDirFlagIndex + 1];
    if (!value) {
      return { exitCode: 1, lines: ["--config-dir requires a path argument"] };
    }
    configDir = resolve(value);
  }

  switch (command) {
    case "sources:validate":
      return runSourcesValidate(configDir);
    case undefined:
      return { exitCode: 1, lines: ["usage: audit <command>", "  sources:validate"] };
    default:
      return {
        exitCode: 1,
        lines: [
          `unknown command: "${command}"`,
          "This session (Session 2) only implements: sources:validate",
        ],
      };
  }
}
