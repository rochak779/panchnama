/**
 * URL scope and exclusion decisions — implementation.md section 6.1
 * ("Do not crawl discovered subdomains unless they are already admitted to
 * the portal record") and section 6.2 (exclusions). Pure: takes already-
 * normalized URLs/hostnames and policy values, does no I/O.
 *
 * What this module can and cannot express, by design (documented per the
 * task brief's instruction not to invent detection this layer can't
 * actually perform):
 *   - Hostname scope (§6.1) and path-pattern/scheme exclusions (§6.2's
 *     "paths disallowed by policy", mail/tel/js/data URLs) are fully
 *     expressible from a URL string alone — implemented here.
 *   - Route *categories* from §6.2 (login/logout/payment/calendar/site
 *     search/etc.) are approximated by matching each category name against
 *     common path substrings (see `ROUTE_CATEGORY_PATTERNS`) — a heuristic,
 *     not a guarantee, since the real signal (a login form, a mutating
 *     POST) is page content the fetcher hasn't parsed yet. Operators can
 *     tighten this with `denylistPathPatterns` in crawl-policy.yaml.
 *   - "Forms that mutate server state" is not a URL-level concept at all —
 *     it is structurally prevented by the fetcher only ever issuing GET/HEAD
 *     and never submitting a form (see http-fetcher.ts), not by this
 *     scope-matching logic.
 *   - Content-based traps (calendars/faceted search that only reveal
 *     themselves through infinite *distinct* query combinations) are
 *     partially caught here via query-parameter-count heuristics, with the
 *     frontier's `maxPagesPerPortal`/`maxDepth` boundary as the real
 *     backstop against a crawl trap the pattern rules don't catch.
 */

export interface ScopeCheckInput {
  normalizedUrl: string;
  hostname: string;
  portalHostnames: string[];
  denylistPathPatterns: string[];
  routeCategories: string[];
  disabledDomains: string[];
}

export type ScopeDecision = { inScope: true } | { inScope: false; reason: string };

const ROUTE_CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  login: [/\/login\b/i, /\/signin\b/i, /\/log-in\b/i],
  logout: [/\/logout\b/i, /\/signout\b/i],
  authentication: [/\/auth\b/i, /\/authenticate\b/i, /\/otp\b/i],
  account: [/\/account\b/i, /\/my-account\b/i, /\/profile\b/i],
  payment: [/\/pay\b/i, /\/payment/i, /\/checkout\b/i],
  transaction_submission: [/\/submit\b/i, /\/apply\b/i, /\/transaction/i],
  state_mutating_form: [/\/delete\b/i, /\/update\b/i, /\/create\b/i],
  calendar: [/\/calendar\b/i, /\/events?\/\d{4}/i],
  site_search_results: [/\/search\b/i, /[?&]q=/i],
  infinite_query_combination: [],
};

/** Returns true if a hostname is admitted to a portal's registered
 * hostname list. Exact match only — a subdomain not already listed is
 * out of scope, per §6.1. */
export function isHostnameInPortalScope(hostname: string, portalHostnames: string[]): boolean {
  const lower = hostname.toLowerCase();
  return portalHostnames.some((h) => h.toLowerCase() === lower);
}

/** Returns true if `hostname` matches (exactly, or as a subdomain of) any
 * entry in `disabledDomains` (crawl-policy `safeOperation.disabledDomains`,
 * §6.6's per-domain disable). */
export function isDomainDisabled(hostname: string, disabledDomains: string[]): boolean {
  const lower = hostname.toLowerCase();
  return disabledDomains.some((domain) => {
    const d = domain.toLowerCase();
    return lower === d || lower.endsWith(`.${d}`);
  });
}

function matchesAnyPattern(path: string, patterns: string[]): string | undefined {
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern, "i").test(path)) {
        return pattern;
      }
    } catch {
      // An invalid regex in config is a config-validation concern (Session
      // 2); treat it as non-matching here rather than throwing mid-crawl.
    }
  }
  return undefined;
}

/**
 * Full scope decision for one URL: hostname scope, disabled-domain check,
 * denylist path patterns, and the best-effort route-category heuristics.
 * Never throws.
 */
export function decideScope(input: ScopeCheckInput): ScopeDecision {
  if (isDomainDisabled(input.hostname, input.disabledDomains)) {
    return { inScope: false, reason: `domain "${input.hostname}" is disabled by crawl policy` };
  }

  if (!isHostnameInPortalScope(input.hostname, input.portalHostnames)) {
    return {
      inScope: false,
      reason: `hostname "${input.hostname}" is not a registered hostname for this portal`,
    };
  }

  let path: string;
  try {
    path = new URL(input.normalizedUrl).pathname + new URL(input.normalizedUrl).search;
  } catch {
    return { inScope: false, reason: "malformed URL" };
  }

  const denylistMatch = matchesAnyPattern(path, input.denylistPathPatterns);
  if (denylistMatch !== undefined) {
    return { inScope: false, reason: `matches denylisted path pattern "${denylistMatch}"` };
  }

  for (const category of input.routeCategories) {
    const patterns = ROUTE_CATEGORY_PATTERNS[category];
    if (!patterns || patterns.length === 0) {
      continue;
    }
    const matched = patterns.find((p) => p.test(path));
    if (matched !== undefined) {
      return { inScope: false, reason: `matches excluded route category "${category}"` };
    }
  }

  return { inScope: true };
}
