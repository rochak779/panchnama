/**
 * Deterministic `Portal.id` derivation from a canonical normalized URL.
 * Deterministic (same canonical URL always yields the same ID) and
 * URL-safe (matches `@panchnama/schema`'s `stableId` pattern: only
 * `A-Za-z0-9._~-`), satisfying section 5's "All IDs must be stable,
 * URL-safe strings. Never use array indexes as identifiers."
 */
export function derivePortalId(canonicalNormalizedUrl: string): string {
  const url = new URL(canonicalNormalizedUrl);
  const host = url.hostname.toLowerCase();
  const pathSlug = url.pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/[^A-Za-z0-9._~-]+/g, "-"))
    .join("-");
  const id = pathSlug.length > 0 ? `${host}-${pathSlug}` : host;
  return id.toLowerCase();
}

/** Deterministic run ID for `inventory:build` output directories:
 * `assam-YYYYMMDDTHHMMSSZ`, derived from a UTC timestamp. */
export function deriveInventoryRunId(nowIso: string): string {
  const compact = nowIso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `assam-${compact}`;
}
