/**
 * @panchnama/audit-core
 *
 * Pure, deterministic audit rules and classifiers (implementation.md
 * section 7): availability/redirect rules, broken-link grouping, HTTPS and
 * certificate checks, freshness signal extraction, directory-mismatch
 * detection, functional-overlap comparison support (rule registry shape
 * only — no rule in this package auto-generates a `possible_overlap`
 * finding; see `rules/registry.ts`), severity/confidence mapping,
 * technical-health derivation, and suggested-action templates. Session 7
 * ("Deterministic audit rules") populated `rules/*`, `technical-health.ts`,
 * and `suggestion.ts`.
 *
 * Rules here remain pure functions over observations, with no network or
 * filesystem access — evidence materialization and I/O live in
 * `packages/audit-cli`'s `analyze` command.
 */

/** Package identifier, used by other packages/tests to confirm resolution. */
export const PACKAGE_NAME = "@panchnama/audit-core" as const;

export * from "./url-normalize.js";
export * from "./crawl-errors.js";
export * from "./ip-range.js";
export * from "./crawl-scope.js";
export * from "./robots-txt.js";
export * from "./link-scan.js";
export * from "./browser-eligibility.js";
export * from "./shell-detect.js";
export * from "./block-detect.js";

export * from "./rules/types.js";
export * from "./rules/params.js";
export * from "./rules/availability.js";
export * from "./rules/broken-link.js";
export * from "./rules/https.js";
export * from "./rules/freshness.js";
export * from "./rules/directory-mismatch.js";
export * from "./rules/crawl-coverage.js";
export * from "./rules/registry.js";
export * from "./technical-health.js";
export * from "./suggestion.js";
