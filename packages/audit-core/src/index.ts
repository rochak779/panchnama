/**
 * @panchnama/audit-core
 *
 * Placeholder entry point. Later sessions will populate this package with
 * pure, deterministic audit rules and classifiers (implementation.md
 * section 7): availability/redirect rules, broken-link grouping, HTTPS and
 * certificate checks, freshness signal extraction, directory-mismatch
 * detection, functional-overlap comparison support, severity/confidence
 * mapping, technical-health derivation, and suggested-action templates.
 *
 * Rules here must remain pure functions over observations wherever
 * possible, with no network or filesystem access.
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
