import { createHash } from "node:crypto";
import {
  decideScope,
  detectEmptyShell,
  isBrowserFallbackEligible,
  normalizeUrl,
  type UrlNormalizationOptions,
} from "@panchnama/audit-core";
import {
  SCHEMA_VERSIONS,
  type EvidenceArtifact,
  type PageObservation,
  type Portal,
} from "@panchnama/schema";
import type { HostScheduler } from "./host-scheduler.js";
import { fetchWithRetry, type HttpFetcherOptions, type RetryOptions } from "./http-fetcher.js";
import { extractHtml, computeShellSignals } from "./html-extract.js";
import type { RobotsCache } from "./robots-fetcher.js";
import {
  fetchWithBrowser,
  type BrowserFetchOptions,
  type BrowserManager,
} from "./browser-fetcher.js";
import { shouldCaptureBrowserEvidence, writeScreenshotEvidence } from "./evidence.js";

/**
 * Crawl frontier — implementation.md section 14 Session 4 ("Crawl frontier
 * with maximum pages and depth") and section 6.1 boundaries.
 *
 * Session 4/5 link-discovery boundary, resolved (per the task brief's
 * judgment call): as of Session 5, the frontier now uses `html-extract.ts`'s
 * full Cheerio-based extraction — not `@panchnama/audit-core`'s minimal
 * `extractRawHrefs` regex scan — for both queue expansion AND populating
 * `PageObservation.title`/`.canonical`/`.language`. Correctness (base-tag
 * resolution, entity decoding) was judged more valuable than the earlier
 * speed shortcut, and doing extraction once per fetched page (rather than
 * once for frontier-walking and again for link-checking) avoids a second,
 * silently-diverging notion of "what a link on this page is." `link-scan.ts`
 * is left in `audit-core`, unused by this module, as a documented
 * superseded building block — see its own doc comment.
 *
 * Every extracted link (in scope or not, followed or not) is also recorded
 * as a `LinkOccurrence` for the link-checking pass (`link-check.ts`) to
 * consume — the frontier's own queueing only follows same-portal-scope
 * links within `maxDepth`, but link-checking must see every discovered
 * destination, internal or external.
 */

export interface LinkOccurrence {
  portalId: string;
  sourcePageUrl: string;
  rawHref: string;
  resolvedUrl?: string;
  anchorText?: string;
  context?: string;
}

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
  /** Section 6.4 / Session 6. `navigationTimeoutMs` reuses
   * `boundaries.requestTimeoutMs` at the call site (documented choice — see
   * `run.ts`); kept as its own field here so a caller/test can diverge from
   * it explicitly. `settleTimeoutMs` bounds the best-effort post-
   * `domcontentloaded` network-idle wait — see `browser-fetcher.ts`'s doc
   * comment for why this is short and allowed to time out silently. */
  jsRendering: {
    browserFallbackEnabled: boolean;
    perPortalAllowlist: string[];
    maxBrowserPagesPerPortal: number;
    maxBrowserResourceBytes: number;
    navigationTimeoutMs: number;
    settleTimeoutMs: number;
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
  /** Every `<a href>` occurrence found on every successfully-fetched HTML
   * page this portal crawl visited — consumed by `checkPortalLinks`. Empty
   * in dry-run mode (no pages are actually fetched/parsed). */
  linkOccurrences: LinkOccurrence[];
  /** `EvidenceArtifact` records produced by browser-mode fallback
   * (Session 6) — only ever non-empty when the "selected evidence only"
   * trigger condition fired (`evidence.ts`'s doc comment). */
  evidenceArtifacts: EvidenceArtifact[];
  /** Convenience rollup — `true` iff any `PageObservation` this portal
   * produced has `fetchMode === "browser"`. This is the same signal
   * `PublishedPortalAssessment.crawlCoverage.browserFallbackUsed` (section
   * 5.10) will eventually be populated from, once Session 8 wires
   * publication — computed here rather than re-derived by every caller. */
  browserFallbackUsed: boolean;
}

export interface FrontierDeps {
  hostScheduler: HostScheduler;
  robotsCache: RobotsCache;
  ssrf?: HttpFetcherOptions["ssrf"];
  now?: () => string;
  retry?: Pick<RetryOptions, "sleepFn" | "randomFn">;
  dryRun?: boolean;
  /** Session 6. Present only when browser-mode fallback could conceivably
   * be used this run (i.e. the caller has already decided to construct
   * one) — its own presence is NOT the eligibility gate; eligibility is
   * still fully re-derived per portal from `policy.jsRendering` and
   * `portalBrowserOverride` below via `isBrowserFallbackEligible`. */
  browserManager?: BrowserManager;
  /** The resolved `overrides.browserFallbackEnabled` value from this
   * portal's `config/portals/<id>.yaml` file, if one exists and sets it;
   * `undefined` when no override file exists or it doesn't set this field.
   * Loaded by `run.ts`, not by this module (this module has no filesystem
   * config-loading concerns). */
  portalBrowserOverride?: boolean;
  /** Directory screenshots are written under (`data/evidence/`). Required
   * only when a browser-mode fetch actually captures a screenshot; unused
   * otherwise. */
  evidenceOutDir?: string;
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
  const linkOccurrences: LinkOccurrence[] = [];
  const evidenceArtifacts: EvidenceArtifact[] = [];
  let sequence = 0;
  let pagesFetched = 0;
  let entryOk = false;
  let entryChecked = false;
  let sawError = false;

  // Section 14 Session 6 — eligibility is derived ONCE per portal, up
  // front, and never re-derived per page. Per the module doc comment and
  // `isBrowserFallbackEligible`'s own doc comment: this gate is checked
  // FIRST; the empty-shell heuristic below is only ever consulted when
  // this is true. Getting this ordering backwards would let a shell-
  // looking page on a non-allowlisted portal trigger a browser launch,
  // violating "never activates globally without policy approval."
  const browserEligibility = isBrowserFallbackEligible({
    globalEnabled: policy.jsRendering.browserFallbackEnabled,
    perPortalAllowlist: policy.jsRendering.perPortalAllowlist,
    portalId: portal.id,
    ...(deps.portalBrowserOverride !== undefined
      ? { overrideEnabled: deps.portalBrowserOverride }
      : {}),
  });
  const browserEligible =
    browserEligibility.eligible && deps.browserManager !== undefined && !dryRun;
  let browserPagesUsed = 0;

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

    // Full Cheerio-based extraction (Session 5) replaces the Session 4
    // minimal regex scan for both this observation's title/canonical/
    // language AND queue expansion — see this file's doc comment.
    const extracted =
      result.ok && isHtmlContentType(result.contentType)
        ? extractHtml(result.bodyText ?? "", result.finalUrl)
        : undefined;

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
      ...(extracted?.title !== undefined ? { title: extracted.title } : {}),
      ...(extracted?.canonical !== undefined ? { canonical: extracted.canonical } : {}),
      ...(extracted?.language !== undefined ? { language: extracted.language } : {}),
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

    if (extracted !== undefined) {
      for (const link of extracted.links) {
        linkOccurrences.push({
          portalId: portal.id,
          sourcePageUrl: norm.normalizedUrl,
          rawHref: link.rawHref,
          ...(link.resolvedUrl !== undefined ? { resolvedUrl: link.resolvedUrl } : {}),
          ...(link.anchorText !== undefined ? { anchorText: link.anchorText } : {}),
          ...(link.context !== undefined ? { context: link.context } : {}),
        });
      }

      if (entry.depth < policy.boundaries.maxDepth) {
        for (const link of extracted.links) {
          if (link.resolvedUrl === undefined) {
            continue;
          }
          const childNorm = normalizeUrl(
            link.resolvedUrl,
            policy.urlNormalization,
            result.finalUrl,
          );
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

    // Section 14 Session 6 — browser-mode fallback. Eligibility (checked
    // first, above, once per portal) gates this entirely; the empty-shell
    // heuristic only ever runs for an already-eligible portal. Browser
    // fallback fetches ONLY the triggering page itself — it does not
    // expand the frontier queue from browser-discovered links (kept out of
    // scope this session; see docs/session-log.md).
    if (
      browserEligible &&
      result.ok &&
      extracted !== undefined &&
      isHtmlContentType(result.contentType)
    ) {
      const shellSignals = computeShellSignals(result.bodyText ?? "", extracted.links.length);
      const shellCheck = detectEmptyShell(shellSignals);

      if (shellCheck.isEmptyShell) {
        if (browserPagesUsed >= policy.jsRendering.maxBrowserPagesPerPortal) {
          skip(
            norm.normalizedUrl,
            entry.depth,
            `browser fallback skipped — maxBrowserPagesPerPortal (${policy.jsRendering.maxBrowserPagesPerPortal}) already reached this run (shell reason: ${shellCheck.reason})`,
          );
        } else {
          browserPagesUsed += 1;
          const browser = await deps.browserManager!.getBrowser();
          const browserOptions: BrowserFetchOptions = {
            navigationTimeoutMs: policy.jsRendering.navigationTimeoutMs,
            settleTimeoutMs: policy.jsRendering.settleTimeoutMs,
            maxResourceBytes: policy.jsRendering.maxBrowserResourceBytes,
            userAgent: policy.robotsAndIdentification.userAgent,
            allowedSchemes: policy.boundaries.allowedSchemes,
            captureScreenshot: true,
            ...(deps.ssrf !== undefined ? { ssrf: deps.ssrf } : {}),
          };
          const browserResult = await deps.hostScheduler.schedule(hostname, () =>
            fetchWithBrowser(norm.normalizedUrl, browser, browserOptions),
          );

          sequence += 1;
          const browserDigest = bodyDigest(browserResult.bodyText);
          const browserExtracted = browserResult.ok
            ? extractHtml(browserResult.bodyText ?? "", browserResult.finalUrl)
            : undefined;

          const browserObservationId = `${runId}-${portal.id}-p${sequence}`;
          let browserArtifactRefs: string[] = [];

          // "Selected evidence only" (evidence.ts's doc comment): capture
          // only when the browser fetch either recovered real content from
          // a detected shell, or was blocked/auth-walled — never on a
          // screenshot with nothing to explain.
          const shouldCaptureEvidence =
            deps.evidenceOutDir !== undefined &&
            shouldCaptureBrowserEvidence({
              ok: browserResult.ok,
              ...(browserResult.errorCode !== undefined
                ? { errorCode: browserResult.errorCode }
                : {}),
              hasScreenshot: browserResult.screenshot !== undefined,
            });
          if (shouldCaptureEvidence) {
            const artifact = writeScreenshotEvidence({
              runId,
              portalId: portal.id,
              pageObservationId: browserObservationId,
              sourceUrl: browserResult.finalUrl,
              screenshot: browserResult.screenshot!,
              description: browserResult.ok
                ? `Browser-mode screenshot: the HTTP fetch looked like an empty client-rendered shell (${shellCheck.reason}); browser rendering recovered content.`
                : `Browser-mode screenshot: navigation was classified ${browserResult.errorCode} (${browserResult.errorMessage ?? "no message"}).`,
              capturedAt: now(),
              evidenceOutDir: deps.evidenceOutDir!,
            });
            evidenceArtifacts.push(artifact);
            browserArtifactRefs = [artifact.id];
          }

          const browserObservation: PageObservation = {
            id: browserObservationId,
            schemaVersion: SCHEMA_VERSIONS.pageObservation,
            runId,
            portalId: portal.id,
            requestedUrl: norm.normalizedUrl,
            ...(browserResult.finalUrl !== norm.normalizedUrl
              ? { finalUrl: browserResult.finalUrl }
              : {}),
            ...(entry.discoveredFrom !== undefined ? { discoveredFrom: entry.discoveredFrom } : {}),
            checkedAt: now(),
            attempt: 1,
            fetchMode: "browser",
            ...(browserResult.httpStatus !== undefined
              ? { httpStatus: browserResult.httpStatus }
              : {}),
            redirectChain: browserResult.redirectChain,
            ...(browserResult.contentType !== undefined
              ? { contentType: browserResult.contentType }
              : {}),
            durationMs: browserResult.durationMs,
            ...(browserExtracted?.title !== undefined ? { title: browserExtracted.title } : {}),
            ...(browserExtracted?.canonical !== undefined
              ? { canonical: browserExtracted.canonical }
              : {}),
            ...(browserExtracted?.language !== undefined
              ? { language: browserExtracted.language }
              : {}),
            ...(browserDigest !== undefined ? { bodyDigest: browserDigest } : {}),
            ...(browserResult.errorCode !== undefined
              ? { errorCode: browserResult.errorCode }
              : {}),
            ...(browserResult.errorMessage !== undefined
              ? { errorMessage: browserResult.errorMessage }
              : {}),
            robotsDecision,
            artifactRefs: browserArtifactRefs,
          };
          pageObservations.push(browserObservation);

          if (browserExtracted !== undefined) {
            for (const link of browserExtracted.links) {
              linkOccurrences.push({
                portalId: portal.id,
                sourcePageUrl: norm.normalizedUrl,
                rawHref: link.rawHref,
                ...(link.resolvedUrl !== undefined ? { resolvedUrl: link.resolvedUrl } : {}),
                ...(link.anchorText !== undefined ? { anchorText: link.anchorText } : {}),
                ...(link.context !== undefined ? { context: link.context } : {}),
              });
            }
          }
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
    linkOccurrences,
    evidenceArtifacts,
    browserFallbackUsed: pageObservations.some((o) => o.fetchMode === "browser"),
  };
}
