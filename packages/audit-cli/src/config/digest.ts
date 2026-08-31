import { createHash } from "node:crypto";

/**
 * Deterministic configuration digest — implementation.md section 9.4
 * (`sourceRegistryDigest`, `crawlPolicyDigest`, `checkConfigDigest` on
 * `AuditRun`, defined in `@panchnama/schema`).
 *
 * One canonicalize-then-hash implementation, reused for all three digests:
 * later sessions call `computeConfigDigest(parsedSourceRegistry)`,
 * `computeConfigDigest(parsedCrawlPolicy)`, and
 * `computeConfigDigest(parsedChecksConfig)` to populate `AuditRun`'s fields
 * once a real crawl/analyze run exists (Session 4+). This session exposes
 * the pure function only; it is not wired into an `AuditRun` yet.
 *
 * Determinism: `canonicalize` recursively sorts object keys before
 * stringifying, so the digest is stable regardless of the source YAML's
 * key order or the parser's object-construction order. Arrays are NOT
 * reordered — element order in a YAML list is meaningful (e.g. source
 * priority, check ordering) and changing it should change the digest.
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, canonicalize(val)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries);
  }
  return value;
}

/** Stable JSON string: canonicalized, deterministic key order. */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * SHA-256 hex digest of a config value's canonical JSON form. Deterministic
 * for equal content regardless of object key order; changes whenever the
 * content changes.
 */
export function computeConfigDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(value), "utf8").digest("hex");
}
