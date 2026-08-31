import { decideScope, isHostnameInPortalScope, normalizeUrl } from "@panchnama/audit-core";
import type { UrlNormalizationOptions } from "@panchnama/audit-core";
import {
  SCHEMA_VERSIONS,
  type LinkObservation,
  type CheckStatus,
  type Portal,
} from "@panchnama/schema";
import type { HostScheduler } from "./host-scheduler.js";
import { fetchWithRetry, type HttpFetcherOptions, type RetryOptions } from "./http-fetcher.js";
import type { LinkOccurrence } from "./frontier.js";

/**
 * Link checking — implementation.md section 14 Session 5, section 7.2
 * (broken links), section 6.2 (exclusions apply to link checking too),
 * section 6.4/9 (GET/HEAD fallback).
 *
 * Dedup design (documented per the task brief's requested precision):
 * deduplication happens at the NETWORK-REQUEST layer, not the record
 * layer. Every `LinkOccurrence` (one per source-page + anchor) becomes its
 * own `LinkObservation` — full traceability, per section 5.6's schema
 * literally carrying one `sourcePageUrl` per record — but the actual
 * HTTP check (HEAD, possibly falling back to GET) is performed exactly
 * once per unique `normalizedDestinationUrl`, and its result
 * (`checkedAt`/`status`/`httpStatus`/`errorCode`/`attempts`) is copied
 * across every occurrence of that destination. This means N source pages
 * linking to the same broken URL never triggers N requests, while the
 * output still answers "which source pages/anchors point at this broken
 * destination" (group by `normalizedDestinationUrl`) — section 7.2's
 * "group identical failed destinations" is a natural byproduct of this
 * design, not separate logic.
 *
 * HEAD/GET fallback heuristic (section 6.4/9, "false HEAD failures"):
 * HEAD is tried first (cheaper — no body). It is deemed a **false**
 * failure — server-specific, not evidence the destination is actually
 * broken — only when the server actually responded with HTTP 405 (Method
 * Not Allowed) or 501 (Not Implemented); those two statuses are the
 * textbook "this server just doesn't support HEAD" signals. Any other
 * outcome (2xx/3xx-resolved success, other 4xx/5xx, or a network/timeout
 * failure) is trusted as-is with no GET fallback, since a HEAD 404 or a
 * timeout is just as informative as a GET one would be, and retrying
 * every real failure as a GET would double the request volume without a
 * clear payoff. Known limitation: a server that behaves differently for
 * HEAD vs GET in some *other* way (e.g. HEAD succeeds but GET 404s, or a
 * WAF that only blocks HEAD with a non-405/501 status) is not covered by
 * this heuristic and is out of scope for this session's judgment call.
 *
 * Exclusion classification reuses `@panchnama/audit-core`'s `decideScope`
 * for denylist-path-pattern / route-category / disabled-domain checks by
 * passing `portalHostnames: [hostname]` — a deliberate trick that makes
 * `decideScope`'s hostname-scope check always pass (link checking must
 * check both internal AND external destinations, unlike frontier
 * queueing, which only follows in-scope hostnames) while still reusing
 * its exclusion-pattern logic rather than re-implementing it.
 */

export interface LinkCheckPolicy {
  urlNormalization: UrlNormalizationOptions;
  exclusions: {
    routeCategories: string[];
    denylistPathPatterns: string[];
    excludedUrlSchemes: string[];
  };
  safeOperation: { disabledDomains: string[] };
  boundaries: {
    requestTimeoutMs: number;
    maxResponseBodyBytes: number;
    maxRedirects: number;
    maxAttemptsAvailabilityCritical: number;
    allowedSchemes: string[];
  };
  robotsAndIdentification: { userAgent: string };
}

export interface LinkCheckDeps {
  hostScheduler: HostScheduler;
  ssrf?: HttpFetcherOptions["ssrf"];
  now?: () => string;
  retry?: Pick<RetryOptions, "sleepFn" | "randomFn">;
}

/** Error code used for links excluded from checking outright (excluded
 * scheme, denylisted path, excluded route category, disabled domain, or a
 * genuinely unparseable destination URL) — reuses the stable
 * `SCOPE_EXCLUDED` code already established by
 * `@panchnama/audit-core`'s crawl-error taxonomy for the analogous
 * frontier-side decision, rather than inventing a parallel code. */
const EXCLUDED_ERROR_CODE = "SCOPE_EXCLUDED";

const FALSE_HEAD_FAILURE_STATUSES = new Set([405, 501]);

interface DestinationCheckResult {
  status: CheckStatus;
  httpStatus?: number;
  errorCode?: string;
  attempts: number;
}

async function checkDestinationOnce(
  url: string,
  fetcherOptionsBase: HttpFetcherOptions,
  retryOptions: RetryOptions,
  hostScheduler: HostScheduler,
): Promise<DestinationCheckResult> {
  const hostname = new URL(url).hostname;

  const headResult = await hostScheduler.schedule(hostname, () =>
    fetchWithRetry(url, { ...fetcherOptionsBase, method: "HEAD" }, retryOptions),
  );

  if (headResult.ok) {
    return {
      status: "pass",
      ...(headResult.httpStatus !== undefined ? { httpStatus: headResult.httpStatus } : {}),
      attempts: headResult.attempts,
    };
  }

  const isFalseHeadFailure =
    headResult.httpStatus !== undefined && FALSE_HEAD_FAILURE_STATUSES.has(headResult.httpStatus);
  if (!isFalseHeadFailure) {
    return {
      status: "fail",
      ...(headResult.httpStatus !== undefined ? { httpStatus: headResult.httpStatus } : {}),
      ...(headResult.errorCode !== undefined ? { errorCode: headResult.errorCode } : {}),
      attempts: headResult.attempts,
    };
  }

  const getResult = await hostScheduler.schedule(hostname, () =>
    fetchWithRetry(url, { ...fetcherOptionsBase, method: "GET" }, retryOptions),
  );
  const attempts = headResult.attempts + getResult.attempts;
  return {
    status: getResult.ok ? "pass" : "fail",
    ...(getResult.httpStatus !== undefined ? { httpStatus: getResult.httpStatus } : {}),
    ...(!getResult.ok && getResult.errorCode !== undefined
      ? { errorCode: getResult.errorCode }
      : {}),
    attempts,
  };
}

interface PreparedOccurrence {
  occurrence: LinkOccurrence;
  destinationUrl: string;
  normalizedDestinationUrl: string;
  hostname: string;
  excluded: boolean;
}

function prepareOccurrence(
  occurrence: LinkOccurrence,
  policy: LinkCheckPolicy,
): PreparedOccurrence | undefined {
  if (occurrence.resolvedUrl === undefined) {
    // Genuinely unresolvable href (malformed) — nothing to check or record
    // as a destination; the frontier already dropped it from queueing.
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(occurrence.resolvedUrl);
  } catch {
    return {
      occurrence,
      destinationUrl: occurrence.resolvedUrl,
      normalizedDestinationUrl: occurrence.resolvedUrl,
      hostname: "",
      excluded: true,
    };
  }

  const scheme = parsed.protocol.replace(":", "");
  if (
    policy.exclusions.excludedUrlSchemes.includes(scheme) ||
    !policy.boundaries.allowedSchemes.includes(scheme)
  ) {
    return {
      occurrence,
      destinationUrl: occurrence.resolvedUrl,
      normalizedDestinationUrl: occurrence.resolvedUrl,
      hostname: parsed.hostname,
      excluded: true,
    };
  }

  const norm = normalizeUrl(occurrence.resolvedUrl, policy.urlNormalization);
  if (!norm.ok) {
    return {
      occurrence,
      destinationUrl: occurrence.resolvedUrl,
      normalizedDestinationUrl: occurrence.resolvedUrl,
      hostname: parsed.hostname,
      excluded: true,
    };
  }

  const scope = decideScope({
    normalizedUrl: norm.normalizedUrl,
    hostname: norm.hostname,
    portalHostnames: [norm.hostname],
    denylistPathPatterns: policy.exclusions.denylistPathPatterns,
    routeCategories: policy.exclusions.routeCategories,
    disabledDomains: policy.safeOperation.disabledDomains,
  });

  return {
    occurrence,
    destinationUrl: occurrence.resolvedUrl,
    normalizedDestinationUrl: norm.normalizedUrl,
    hostname: norm.hostname,
    excluded: !scope.inScope,
  };
}

/** Checks every discovered link destination for one portal's crawl,
 * deduplicated by normalized destination (see module doc comment), and
 * returns one `LinkObservation` per source-page occurrence. Never called
 * in dry-run mode (no pages are fetched, so there is nothing to check). */
export async function checkPortalLinks(
  portal: Portal,
  runId: string,
  occurrences: LinkOccurrence[],
  policy: LinkCheckPolicy,
  deps: LinkCheckDeps,
): Promise<LinkObservation[]> {
  const now = deps.now ?? (() => new Date().toISOString());
  const fetcherOptionsBase: HttpFetcherOptions = {
    requestTimeoutMs: policy.boundaries.requestTimeoutMs,
    maxResponseBodyBytes: policy.boundaries.maxResponseBodyBytes,
    maxRedirects: policy.boundaries.maxRedirects,
    userAgent: policy.robotsAndIdentification.userAgent,
    allowedSchemes: policy.boundaries.allowedSchemes,
    ...(deps.ssrf !== undefined ? { ssrf: deps.ssrf } : {}),
  };
  const retryOptions: RetryOptions = {
    maxAttempts: policy.boundaries.maxAttemptsAvailabilityCritical,
    baseDelayMs: 200,
    ...(deps.retry ?? {}),
  };

  const prepared = occurrences
    .map((occ) => prepareOccurrence(occ, policy))
    .filter((p): p is PreparedOccurrence => p !== undefined);

  const checkableDestinations = [
    ...new Set(prepared.filter((p) => !p.excluded).map((p) => p.normalizedDestinationUrl)),
  ];

  const resultsByDestination = new Map<string, DestinationCheckResult & { checkedAt: string }>();
  for (const dest of checkableDestinations) {
    const checkedAt = now();
    const result = await checkDestinationOnce(
      dest,
      fetcherOptionsBase,
      retryOptions,
      deps.hostScheduler,
    );
    resultsByDestination.set(dest, { ...result, checkedAt });
  }

  const observations: LinkObservation[] = [];
  let sequence = 0;
  for (const p of prepared) {
    sequence += 1;
    const relationship = isHostnameInPortalScope(p.hostname, portal.hostnames)
      ? "internal"
      : "external";

    if (p.excluded) {
      observations.push({
        id: `${runId}-${portal.id}-l${sequence}`,
        schemaVersion: SCHEMA_VERSIONS.linkObservation,
        runId,
        portalId: portal.id,
        sourcePageUrl: p.occurrence.sourcePageUrl,
        destinationUrl: p.destinationUrl,
        normalizedDestinationUrl: p.normalizedDestinationUrl,
        ...(p.occurrence.anchorText !== undefined ? { anchorText: p.occurrence.anchorText } : {}),
        relationship,
        ...(p.occurrence.context !== undefined ? { context: p.occurrence.context } : {}),
        checkedAt: now(),
        status: "not_applicable",
        errorCode: EXCLUDED_ERROR_CODE,
        attempts: 0,
      });
      continue;
    }

    const shared = resultsByDestination.get(p.normalizedDestinationUrl)!;
    observations.push({
      id: `${runId}-${portal.id}-l${sequence}`,
      schemaVersion: SCHEMA_VERSIONS.linkObservation,
      runId,
      portalId: portal.id,
      sourcePageUrl: p.occurrence.sourcePageUrl,
      destinationUrl: p.destinationUrl,
      normalizedDestinationUrl: p.normalizedDestinationUrl,
      ...(p.occurrence.anchorText !== undefined ? { anchorText: p.occurrence.anchorText } : {}),
      relationship,
      ...(p.occurrence.context !== undefined ? { context: p.occurrence.context } : {}),
      checkedAt: shared.checkedAt,
      status: shared.status,
      ...(shared.httpStatus !== undefined ? { httpStatus: shared.httpStatus } : {}),
      ...(shared.errorCode !== undefined ? { errorCode: shared.errorCode } : {}),
      attempts: shared.attempts,
    });
  }

  return observations;
}
