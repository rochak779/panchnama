/**
 * @panchnama/audit-cli
 *
 * Placeholder entry point. Later sessions will populate this package with
 * the `pnpm audit <command>` dispatcher (implementation.md section 9.1):
 * sources:validate, inventory:build, inventory:validate, crawl, analyze,
 * review:validate, publish, export, and report — plus the moderation
 * commands (experiences:queue, experiences:moderate, experiences:aggregate,
 * experiences:retention) added in Session 9.
 */

/** Package identifier, used by other packages/tests to confirm resolution. */
export const PACKAGE_NAME = "@panchnama/audit-cli" as const;
