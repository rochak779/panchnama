/**
 * @panchnama/audit-cli
 *
 * `pnpm audit <command>` — implementation.md section 9.1: sources:validate,
 * inventory:build, inventory:validate, crawl, analyze, review:validate,
 * publish, export, and report — plus the moderation commands
 * (experiences:queue, experiences:moderate, experiences:aggregate,
 * experiences:retention) added in Session 9.
 *
 * This session (Session 2) implements `sources:validate` and the
 * configuration schemas/validation/digest machinery it depends on. Other
 * commands remain unimplemented until their sessions.
 *
 * `src/cli.ts` / `src/bin.ts` hold the process-facing dispatcher (argv in,
 * exit code out). This file is the library entry point: it re-exports the
 * config schemas, loader, validator, and digest function so later sessions
 * (and tests) can import them programmatically without shelling out.
 */

/** Package identifier, used by other packages/tests to confirm resolution. */
export const PACKAGE_NAME = "@panchnama/audit-cli" as const;

export * from "./config/index.js";
export * from "./commands/sources-validate.js";
export * from "./commands/inventory-build.js";
export * from "./commands/inventory-validate.js";
export * from "./inventory/candidate.js";
export * from "./inventory/build.js";
export * from "./review/paths.js";
export * from "./review/validate.js";
export * from "./review/publish-run.js";
export * from "./review/transform.js";
export * from "./review/export.js";
export * from "./review/report.js";
export * from "./cli.js";
