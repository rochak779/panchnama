import { createHash } from "node:crypto";
import {
  decideScope,
  extractRawHrefs,
  normalizeUrl,
  type UrlNormalizationOptions,
} from "@panchnama/audit-core";
import { SCHEMA_VERSIONS, type PageObservation, type Portal } from "@panchnama/schema";
import type { HostScheduler } from "./host-scheduler.js";
import { fetchWithRetry, type HttpFetcherOptions, type RetryOptions } from "./http-fetcher.js";
import type { RobotsCache } from "./robots-fetcher.js";

/**
 * Crawl frontier — implementation.md section 14 Session 4 ("Crawl frontier
 * with maximum pages and depth") and section 6.1 boundaries.
 *
 * Session 4/5 link-discovery boundary (documented per the task brief): this
 * module uses `@panchnama/audit-core`'s `extractRawHrefs`, a minimal
 * regex-based `<a href>` scan, to discover outbound URLs to walk the
 * frontier. It does NOT extract title/canonical/language/anchor
 * text/link-context — that is Session 5's full HTML extraction, which will
 * replace this minimal scan. This module's only use of a fetched page's
 * body is "what URLs does it link to," nothing else.
 */

export interface FrontierPolicy {
  boundaries: {
    maxPagesPerPortal: number;
    maxDepth: number;
    requestTimeoutMs: number;
    maxResponseBodyBytes: number;
    maxRedirects: number;
    maxAttemptsAvailabilityCritical: number;
    allowedSchemes: string[];
  };
  exclusions: {
    routeCategories: string[];
    denylistPathPatterns: string[];
  };
  robotsAndIdentification: {
    userAgent: string;
    respectRobotsTxt: boolean;
  };
  urlNormalization: UrlNormalizationOptions;
  safeOperation: {
    disabledDomains: string[];
  };
}

export interface SkipLogEntry {
  portalId: string;
  url: string;
  depth: number;
  reason: string;
}

export interface CrawlPortalResult {
  portalId: string;
  pageObservations: PageObservation[];
  skipLog: SkipLogEntry[];
  /** Populated only in dry-run mode: the URLs that would have been fetched. */
  plannedUrls: string[];
  status: "succeeded" | "partial" | "failed";
  pagesFetched: number;
}

export interface FrontierDeps {
  hostScheduler: HostScheduler;
  robotsCache: RobotsCache;
  ssrf?: HttpFetcherOptions["ssrf"];
  now?: () => string;
  retry?: Pick<RetryOptions, "sleepFn" | "randomFn">;
  dryRun?: boolean;
}

interface QueueEntry {
  url: string;
  depth: number;
  discoveredFrom?: string;
}

function isHtmlContentType(contentType: string | undefined): boolean {
  return contentType !== undefined && contentType.toLowerCase().includes("text/html");
}

function bodyDigest(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Crawls a single portal's frontier up to `maxPagesPerPortal`/`maxDepth`,
 * respecting scope, exclusions, robots.txt, and disabled domains. Never
 * throws for ordinary crawl failures (network errors become
 * `PageObservation.errorCode` entries) — only an unexpected internal bug
 * would throw, and `run.ts` isolates each portal's call in a try/catch so
 * one portal's failure cannot stop the run. */
export async function crawlPortal(
  portal: Portal,
  runId: string,
  policy: FrontierPolicy,
  maxPagesOverride: number | undefined,
  deps: FrontierDeps,
): Promise<CrawlPortalResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const maxPages = maxPagesOverride ?? policy.boundaries.maxPagesPerPortal;
  const dryRun = deps.dryRun === true;

  const fetcherOptions: HttpFetcherOptions = {
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

  const visited = new Set<string>();
  const pageObservations: PageObservation[] = [];
  const skipLog: SkipLogEntry[] = [];
  const plannedUrls: string[] = [];
  let sequence = 0;
  let pagesFetched = 0;
  let entryOk = false;
  let entryChecked = false;
  let sawError = false;

  const seedUrls = [portal.canonicalUrl, ...portal.alternateUrls];
  const queue: QueueEntry[] = seedUrls.map((url) => ({ url, depth: 0 }));

  function skip(url: string, depth: number, reason: string): void {
    skipLog.push({ portalId: portal.id, url, depth, reason });
  }

  while (queue.length > 0) {
    const entry = queue.shift()!;

    const norm = normalizeUrl(entry.url, policy.urlNormalization, entry.discoveredFrom);
    if (!norm.ok) {
      skip(entry.url, entry.depth, `malformed URL: ${norm.reason}`);
      continue;
    }
    if (visited.has(norm.normalizedUrl)) {
      continue;
    }
    visited.add(norm.normalizedUrl);

    const scopeDecision = decideScope({
      normalizedUrl: norm.normalizedUrl,
      hostname: norm.hostname,
      portalHostnames: portal.hostnames,
      denylistPathPatterns: policy.exclusions.denylistPathPatterns,
      routeCategories: policy.exclusions.routeCategories,
      disabledDomains: policy.safeOperation.disabledDomains,
    });
    if (!scopeDecision.inScope) {
      skip(norm.normalizedUrl, entry.depth, scopeDecision.reason);
      continue;
    }

    if (pagesFetched >= maxPages) {
      skip(norm.normalizedUrl, entry.depth, "maxPagesPerPortal reached");
      continue;
    }

    if (dryRun) {
      plannedUrls.push(norm.normalizedUrl);
      pagesFetched += 1;
      if (!entryChecked) {
        entryChecked = true;
        entryOk = true;
      }
      continue;
    }

    let robotsDecision: PageObservation["robotsDecision"] = "not_checked";
    if (policy.robotsAndIdentification.respectRobotsTxt) {
      robotsDecision = await deps.robotsCache.decide(norm.normalizedUrl);
    }

    if (robotsDecision === "disallowed") {
      sequence += 1;
      pageObservations.push({
        id: `${runId}-${portal.id}-p${sequence}`,
        schemaVersion: SCHEMA_VERSIONS.pageObservation,
        runId,
        portalId: portal.id,
        requestedUrl: norm.normalizedUrl,
        ...(entry.discoveredFrom !== undefined ? { discoveredFrom: entry.discoveredFrom } : {}),
        checkedAt: now(),
        attempt: 1,
        fetchMode: "http",
        redirectChain: [],
        robotsDecision: "disallowed",
        artifactRefs: [],
      });
      skip(norm.normalizedUrl, entry.depth, "robots_disallowed");
      continue;
    }

    pagesFetched += 1;
    const hostname = norm.hostname;
    const result = await deps.hostScheduler.schedule(hostname, () =>
      fetchWithRetry(norm.normalizedUrl, fetcherOptions, retryOptions),
    );

    sequence += 1;
    const digest = bodyDigest(result.bodyText);
    const observation: PageObservation = {
      id: `${runId}-${portal.id}-p${sequence}`,
      schemaVersion: SCHEMA_VERSIONS.pageObservation,
      runId,
      portalId: portal.id,
      requestedUrl: norm.normalizedUrl,
      ...(result.finalUrl !== norm.normalizedUrl ? { finalUrl: result.finalUrl } : {}),
      ...(entry.discoveredFrom !== undefined ? { discoveredFrom: entry.discoveredFrom } : {}),
      checkedAt: now(),
      attempt: result.attempts,
      fetchMode: "http",
      ...(result.httpStatus !== undefined ? { httpStatus: result.httpStatus } : {}),
      redirectChain: result.redirectChain,
      ...(result.contentType !== undefined ? { contentType: result.contentType } : {}),
      durationMs: result.durationMs,
      ...(digest !== undefined ? { bodyDigest: digest } : {}),
      ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}),
      ...(result.errorMessage !== undefined ? { errorMessage: result.errorMessage } : {}),
      robotsDecision,
      artifactRefs: [],
    };
    pageObservations.push(observation);

    if (!entryChecked) {
      entryChecked = true;
      entryOk = result.ok;
    }
    if (!result.ok) {
      sawError = true;
    }

    if (
      result.ok &&
      isHtmlContentType(result.contentType) &&
      entry.depth < policy.boundaries.maxDepth
    ) {
      const hrefs = extractRawHrefs(result.bodyText ?? "");
      for (const href of hrefs) {
        const childNorm = normalizeUrl(href, policy.urlNormalization, result.finalUrl);
        if (childNorm.ok && !visited.has(childNorm.normalizedUrl)) {
          queue.push({
            url: childNorm.normalizedUrl,
            depth: entry.depth + 1,
            discoveredFrom: norm.normalizedUrl,
          });
        }
      }
    }
  }

  const status: CrawlPortalResult["status"] = !entryOk
    ? "failed"
    : sawError
      ? "partial"
      : "succeeded";

  return {
    portalId: portal.id,
    pageObservations,
    skipLog,
    plannedUrls,
    status,
    pagesFetched,
  };
}
