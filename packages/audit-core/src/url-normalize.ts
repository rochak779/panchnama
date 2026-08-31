/**
 * URL normalization — implementation.md section 6.5.
 *
 * Lives in `@panchnama/audit-core` (not `packages/audit-cli`) because it is
 * a pure, deterministic, no-I/O function with no dependency on any config
 * schema or file format, and both Session 3's inventory ingestion and the
 * future crawler (Session 4+, section 6.5 applies to crawl-time link
 * resolution too) need the exact same rules. Putting it in the shared
 * "pure audit rules and classifiers" package (section 4.3) avoids
 * duplicating or drifting the normalization logic between ingestion and
 * crawling.
 *
 * Rules implemented (section 6.5, each bullet):
 *   - lowercase scheme and hostname;
 *   - remove default ports (80 for http, 443 for https);
 *   - remove fragments (`removeFragments` option);
 *   - resolve relative URLs (`baseUrl` parameter);
 *   - normalize trailing slashes under a documented policy
 *     (`trailingSlashPolicy` option — see below);
 *   - remove known tracking parameters (`trackingParameterDenylist` option);
 *   - sort retained query parameters (`sortRetainedQueryParameters` option);
 *   - preserve the originally observed URL alongside the normalized URL
 *     (`originalUrl` on the result).
 *
 * Trailing-slash policy: "strip" removes a trailing slash from any path
 * longer than just "/" (so `/foo/` -> `/foo`, but the root path stays
 * `/`); "preserve" leaves the path exactly as parsed. This mirrors
 * `config/crawl-policy.yaml`'s `urlNormalization.trailingSlashPolicy`
 * field (Session 2), whose default value is "strip".
 *
 * Explicitly NOT done here, by design (see docs/session-log.md "Session 3"
 * for the full reasoning):
 *   - scheme is lowercased for consistency, but http and https are never
 *     treated as interchangeable/equivalent for identity purposes — this
 *     function will produce two different normalized URLs for
 *     `http://host/path` and `https://host/path`. Section 6.5 lists
 *     specific normalization rules and does not list "merge http/https,"
 *     and "do not merge URLs solely because their page titles match" signals
 *     the spec's general bias toward conservative, evidence-based merging.
 *     A crawler-observed redirect (Session 4+) or an explicit manual alias
 *     (see `data/seed/aliases.json`, Session 3) are the only sanctioned
 *     ways to treat an http/https pair as the same portal.
 *   - redirect-aware normalization (following an actual redirect chain to
 *     find a "true" canonical URL) is deferred to Session 4+, where the
 *     crawler will observe real redirect chains. No redirect concept is
 *     fabricated here.
 */

export interface UrlNormalizationOptions {
  trailingSlashPolicy: "strip" | "preserve";
  removeFragments: boolean;
  trackingParameterDenylist: string[];
  sortRetainedQueryParameters: boolean;
}

/**
 * Matches `config/crawl-policy.yaml`'s committed defaults (Session 2), so
 * callers that don't have a loaded crawl-policy config handy (e.g. a unit
 * test) get sensible behavior without duplicating the YAML.
 */
export const DEFAULT_URL_NORMALIZATION_OPTIONS: UrlNormalizationOptions = {
  trailingSlashPolicy: "strip",
  removeFragments: true,
  trackingParameterDenylist: [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
  ],
  sortRetainedQueryParameters: true,
};

export type NormalizeUrlResult =
  | { ok: true; originalUrl: string; normalizedUrl: string; hostname: string }
  | { ok: false; originalUrl: string; reason: string };

/**
 * Normalizes a single observed URL. `rawUrl` may be relative when `baseUrl`
 * is supplied (e.g. an `<a href>` extracted from a seed HTML page); it is
 * resolved against `baseUrl` before any other rule is applied.
 *
 * Never throws. Malformed input (unparsable URL, unsupported scheme, empty
 * string) is reported as `{ ok: false, reason }` so callers can flag it
 * explicitly rather than silently dropping or silently including it.
 */
export function normalizeUrl(
  rawUrl: string,
  options: UrlNormalizationOptions = DEFAULT_URL_NORMALIZATION_OPTIONS,
  baseUrl?: string,
): NormalizeUrlResult {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return { ok: false, originalUrl: rawUrl, reason: "empty URL" };
  }

  let parsed: URL;
  try {
    parsed = baseUrl !== undefined ? new URL(trimmed, baseUrl) : new URL(trimmed);
  } catch {
    return { ok: false, originalUrl: rawUrl, reason: "malformed URL (failed to parse)" };
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") {
    return {
      ok: false,
      originalUrl: rawUrl,
      reason: `unsupported scheme "${scheme}" (only http/https are admitted as portal URLs)`,
    };
  }

  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (scheme === "http:" && parsed.port === "80") ||
    (scheme === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  if (options.removeFragments) {
    parsed.hash = "";
  }

  for (const key of options.trackingParameterDenylist) {
    parsed.searchParams.delete(key);
  }

  if (options.sortRetainedQueryParameters) {
    const entries = [...parsed.searchParams.entries()].sort(([aKey, aVal], [bKey, bVal]) => {
      if (aKey !== bKey) {
        return aKey < bKey ? -1 : 1;
      }
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    });
    parsed.search = "";
    for (const [key, value] of entries) {
      parsed.searchParams.append(key, value);
    }
  }

  if (parsed.pathname === "") {
    parsed.pathname = "/";
  }
  if (
    options.trailingSlashPolicy === "strip" &&
    parsed.pathname.length > 1 &&
    parsed.pathname.endsWith("/")
  ) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return {
    ok: true,
    originalUrl: rawUrl,
    normalizedUrl: parsed.toString(),
    hostname: parsed.hostname,
  };
}
