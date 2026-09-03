import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import type {
  AuditRun,
  EvidenceArtifact,
  LinkObservation,
  PageObservation,
  Portal,
} from "@panchnama/schema";
import {
  portalSchema,
  pageObservationSchema,
  linkObservationSchema,
  auditRunSchema,
  evidenceArtifactSchema,
} from "@panchnama/schema";
import { z } from "zod";
import { readFileSync } from "node:fs";
import {
  checksConfigSchema,
  crawlPolicyConfigSchema,
  loadYamlConfig,
  portalOverrideConfigSchema,
  sourceRegistryConfigSchema,
  type ChecksConfig,
  type CrawlPolicyConfig,
  type PortalOverrideConfig,
  type SourceRegistryConfig,
} from "../config/index.js";
import { readLatestRunId } from "../inventory/write.js";
import { crawlPortal, type SkipLogEntry } from "./frontier.js";
import { checkPortalLinks } from "./link-check.js";
import { HostScheduler } from "./host-scheduler.js";
import { RobotsCache } from "./robots-fetcher.js";
import type { HttpFetcherOptions } from "./http-fetcher.js";
import { BrowserManager } from "./browser-fetcher.js";
import { buildAuditRun, getCodeRevision } from "./manifest.js";
import { defaultCrawlRunId } from "./id.js";
import { listExistingCrawlRunIds, writeCrawlRunAtomic } from "./write.js";

/** Best-effort, short settle window given to browser-mode navigations
 * after `domcontentloaded` fires, before reading whatever has rendered —
 * see `browser-fetcher.ts`'s doc comment. Not exposed in
 * `config/crawl-policy.yaml` (documented choice: this session reuses
 * `boundaries.requestTimeoutMs` as the browser navigation timeout itself,
 * rather than growing the schema for a second browser-specific timeout
 * value; this settle window is a small, fixed implementation detail of how
 * "readiness" is defined, not a boundary an auditor needs to tune). */
const BROWSER_SETTLE_TIMEOUT_MS = 2000;

/** Loads every `config/portals/<id>.yaml` override file present, returning
 * a map from portal id to its `overrides.browserFallbackEnabled` value
 * (only entries that actually set that field are included — a file that
 * exists but doesn't set it, or no file at all, both mean "no override
 * signal", per `isBrowserFallbackEligible`'s documented semantics).
 * Malformed override files are silently skipped here — `sources:validate`
 * is the place shape errors are surfaced; a crawl run should not fail
 * because of an unrelated portal's broken override file. */
function loadPortalBrowserOverrides(configDir: string): Map<string, boolean> {
  const overrides = new Map<string, boolean>();
  const portalsDir = join(configDir, "portals");
  if (!existsSync(portalsDir)) {
    return overrides;
  }
  const files = readdirSync(portalsDir).filter(
    (name) => name.endsWith(".yaml") || name.endsWith(".yml"),
  );
  for (const fileName of files) {
    const result = loadYamlConfig<PortalOverrideConfig>(
      join(portalsDir, fileName),
      portalOverrideConfigSchema,
    );
    if (result.ok && result.value.overrides.browserFallbackEnabled !== undefined) {
      overrides.set(result.value.portalId, result.value.overrides.browserFallbackEnabled);
    }
  }
  return overrides;
}

export interface RunCrawlParams {
  configDir: string;
  inventoryOutDir: string;
  crawlOutDir: string;
  /** `data/evidence/` — where browser-mode screenshot evidence is written
   * (section 4.3). Defaults to a sibling `evidence` directory next to
   * `crawlOutDir` when omitted, which is convenient for tests that don't
   * care about the exact evidence path; the real CLI entry point always
   * passes the repo's actual `data/evidence` directory explicitly. */
  evidenceOutDir?: string;
  repoRoot: string;
  /** Explicit run id, or auto-derived if omitted. */
  runId?: string;
  /** Which inventory build to crawl; defaults to its `latest` pointer. */
  inventoryRunId?: string;
  /** Scope to a single portal id (`--portal`). */
  portalId?: string;
  /** `--max-pages` override, applied to every crawled portal this run. */
  maxPagesOverride?: number;
  dryRun?: boolean;
  now?: () => string;
  /** Test-only: threaded through to the fetcher's SSRF check. Never set
   * from the real CLI entry point. */
  ssrf?: HttpFetcherOptions["ssrf"];
  /** Test-only: avoids real host-scheduler delays / retry backoff waits. */
  sleepFn?: (ms: number) => Promise<void>;
}

export interface RunCrawlFailure {
  ok: false;
  lines: string[];
}

export interface RunCrawlDryRunSuccess {
  ok: true;
  dryRun: true;
  lines: string[];
}

export interface RunCrawlSuccess {
  ok: true;
  dryRun: false;
  runId: string;
  manifest: AuditRun;
  outputDir: string;
  lines: string[];
}

export type RunCrawlResult = RunCrawlFailure | RunCrawlDryRunSuccess | RunCrawlSuccess;

export async function runCrawl(params: RunCrawlParams): Promise<RunCrawlResult> {
  const now = params.now ?? (() => new Date().toISOString());
  const startedAt = now();

  const sourceRegistryResult = loadYamlConfig<SourceRegistryConfig>(
    join(params.configDir, "sources.assam.yaml"),
    sourceRegistryConfigSchema,
  );
  if (!sourceRegistryResult.ok) {
    return {
      ok: false,
      lines: sourceRegistryResult.issues.map((i) => `${i.file} [${i.path}]: ${i.reason}`),
    };
  }
  const crawlPolicyResult = loadYamlConfig<CrawlPolicyConfig>(
    join(params.configDir, "crawl-policy.yaml"),
    crawlPolicyConfigSchema,
  );
  if (!crawlPolicyResult.ok) {
    return {
      ok: false,
      lines: crawlPolicyResult.issues.map((i) => `${i.file} [${i.path}]: ${i.reason}`),
    };
  }
  const checksResult = loadYamlConfig<ChecksConfig>(
    join(params.configDir, "checks.yaml"),
    checksConfigSchema,
  );
  if (!checksResult.ok) {
    return {
      ok: false,
      lines: checksResult.issues.map((i) => `${i.file} [${i.path}]: ${i.reason}`),
    };
  }

  const crawlPolicy = crawlPolicyResult.value;

  // 6.6 Safe operation — global kill switch. Checked before anything else,
  // including dry-run planning: "refuse to run at all."
  if (crawlPolicy.safeOperation.globalKillSwitch) {
    return {
      ok: false,
      lines: [
        "crawl REFUSED — crawlPolicy.safeOperation.globalKillSwitch is true.",
        "  No requests were made. Set globalKillSwitch: false in config/crawl-policy.yaml to re-enable crawling.",
      ],
    };
  }

  // Load the inventory build to crawl.
  const inventoryRunId = params.inventoryRunId ?? readLatestRunId(params.inventoryOutDir);
  if (inventoryRunId === undefined) {
    return {
      ok: false,
      lines: [
        "crawl FAILED — no inventory build found. Run `pnpm run audit inventory:build --state assam` first, or pass --inventory-run-id.",
      ],
    };
  }
  const portalsPath = join(params.inventoryOutDir, inventoryRunId, "portals.json");
  let portals: Portal[];
  try {
    const parsed = z.array(portalSchema).safeParse(JSON.parse(readFileSync(portalsPath, "utf8")));
    if (!parsed.success) {
      return {
        ok: false,
        lines: [`crawl FAILED — ${portalsPath} failed schema validation: ${parsed.error.message}`],
      };
    }
    portals = parsed.data;
  } catch (error) {
    return {
      ok: false,
      lines: [
        `crawl FAILED — could not read inventory portals at ${portalsPath}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  if (params.portalId !== undefined) {
    portals = portals.filter((p) => p.id === params.portalId);
    if (portals.length === 0) {
      return {
        ok: false,
        lines: [
          `crawl FAILED — no portal with id "${params.portalId}" in inventory run "${inventoryRunId}".`,
        ],
      };
    }
  }

  const runId =
    params.runId ?? defaultCrawlRunId(startedAt, listExistingCrawlRunIds(params.crawlOutDir));

  const hostScheduler = new HostScheduler({
    maxConcurrentRequestsPerHost: crawlPolicy.boundaries.maxConcurrentRequestsPerHost,
    minDelayMsPerHost: crawlPolicy.boundaries.minDelayMsPerHost,
    ...(params.sleepFn !== undefined ? { sleepFn: params.sleepFn } : {}),
  });
  const fetcherOptionsBase: HttpFetcherOptions = {
    requestTimeoutMs: crawlPolicy.boundaries.requestTimeoutMs,
    maxResponseBodyBytes: crawlPolicy.boundaries.maxResponseBodyBytes,
    maxRedirects: crawlPolicy.boundaries.maxRedirects,
    userAgent: crawlPolicy.robotsAndIdentification.userAgent,
    allowedSchemes: crawlPolicy.boundaries.allowedSchemes,
    ...(params.ssrf !== undefined ? { ssrf: params.ssrf } : {}),
  };
  const robotsCache = new RobotsCache(
    fetcherOptionsBase,
    crawlPolicy.robotsAndIdentification.userAgent,
  );

  // Section 14 Session 6 — browser fallback. `browserManager` is always
  // constructed (its constructor performs no I/O — see `BrowserManager`'s
  // doc comment) but only ever actually launches a Chromium process when
  // `crawlPortal` calls `getBrowser()`, which it only does for a portal
  // `isBrowserFallbackEligible` has already approved. This means a run
  // with `jsRendering.browserFallbackEnabled: false` launches zero
  // browsers, full stop — the eligibility gate lives entirely in
  // `frontier.ts`/`audit-core`, not here.
  const browserManager = new BrowserManager();
  const portalBrowserOverrides = loadPortalBrowserOverrides(params.configDir);
  const evidenceOutDir = params.evidenceOutDir ?? join(params.crawlOutDir, "..", "evidence");
  const allEvidenceArtifacts: EvidenceArtifact[] = [];
  let anyBrowserFallbackUsed = false;

  const lines: string[] = [
    `crawl run: ${runId}`,
    `inventory: ${inventoryRunId}`,
    `portals: ${portals.length}`,
  ];
  if (params.dryRun) {
    lines.push("mode: --dry-run (no network requests will be made)");
  }

  const allPageObservations: PageObservation[] = [];
  const allLinkObservations: LinkObservation[] = [];
  const allSkipLog: SkipLogEntry[] = [];
  let succeeded = 0;
  let failed = 0;
  let partial = 0;
  const limitations: string[] = [
    "Browser-mode fallback (Session 6) only fetches the single triggering page itself via Playwright — it does not expand the frontier queue or follow deeper links discovered through client-side rendering, so coverage of a client-rendered portal beyond its entry shell page remains bounded by ordinary HTTP-mode crawling.",
    "Browser-mode fallback only activates for portals explicitly allowlisted (or override-enabled) in config, and only when the global `jsRendering.browserFallbackEnabled` switch is on; a client-rendered portal not configured this way will show reduced coverage, both for extraction and for link discovery.",
    "Empty-shell, auth-wall, and CAPTCHA/bot-block detection (Session 6) are best-effort heuristics over rendered HTML, not guarantees — see docs/session-log.md for documented false-positive/false-negative limits.",
    "Link checking only ever issues HEAD (falling back to GET on a 405/501) or GET requests, and only against links actually discovered in server-rendered or browser-rendered HTML — it does not simulate form submission or JS-triggered navigation.",
  ];

  let portalIndex = 0;
  for (const portal of portals) {
    portalIndex += 1;
    // Progress visibility (added Session 17 estate-wide crawl, 2026-09-03):
    // this run's own output is only written atomically at the very end
    // (see writeCrawlRunAtomic below), which left a multi-hour real crawl
    // completely unobservable — no way to tell "still working" from
    // "stuck" from outside the process. These stderr lines never touch
    // the atomic output; they're pure operator visibility.
    const portalStartedAt = Date.now();
    process.stderr.write(
      `[crawl] (${portalIndex}/${portals.length}) starting ${portal.id} (${portal.canonicalUrl})...\n`,
    );
    // Section 14 Session 4 exit criterion: "one portal failure does not
    // stop the run" — isolate every portal's crawl in its own try/catch.
    try {
      const portalBrowserOverride = portalBrowserOverrides.get(portal.id);
      const result = await crawlPortal(
        portal,
        runId,
        {
          boundaries: crawlPolicy.boundaries,
          exclusions: crawlPolicy.exclusions,
          robotsAndIdentification: crawlPolicy.robotsAndIdentification,
          jsRendering: {
            browserFallbackEnabled: crawlPolicy.jsRendering.browserFallbackEnabled,
            perPortalAllowlist: crawlPolicy.jsRendering.perPortalAllowlist,
            maxBrowserPagesPerPortal: crawlPolicy.jsRendering.maxBrowserPagesPerPortal,
            maxBrowserResourceBytes: crawlPolicy.jsRendering.maxBrowserResourceBytes,
            // Documented choice (see BROWSER_SETTLE_TIMEOUT_MS above):
            // reuse the ordinary HTTP request timeout as the browser
            // navigation timeout rather than adding a second config field.
            navigationTimeoutMs: crawlPolicy.boundaries.requestTimeoutMs,
            settleTimeoutMs: BROWSER_SETTLE_TIMEOUT_MS,
          },
          urlNormalization: crawlPolicy.urlNormalization,
          safeOperation: { disabledDomains: crawlPolicy.safeOperation.disabledDomains },
        },
        params.maxPagesOverride,
        {
          hostScheduler,
          robotsCache,
          ...(params.ssrf !== undefined ? { ssrf: params.ssrf } : {}),
          now,
          ...(params.sleepFn !== undefined
            ? { retry: { sleepFn: params.sleepFn, randomFn: () => 0 } }
            : {}),
          dryRun: params.dryRun === true,
          browserManager,
          ...(portalBrowserOverride !== undefined ? { portalBrowserOverride } : {}),
          evidenceOutDir,
        },
      );

      allPageObservations.push(...result.pageObservations);
      allSkipLog.push(...result.skipLog);
      allEvidenceArtifacts.push(...result.evidenceArtifacts);
      if (result.browserFallbackUsed) {
        anyBrowserFallbackUsed = true;
      }

      if (!params.dryRun && result.linkOccurrences.length > 0) {
        const linkObservations = await checkPortalLinks(
          portal,
          runId,
          result.linkOccurrences,
          {
            urlNormalization: crawlPolicy.urlNormalization,
            exclusions: crawlPolicy.exclusions,
            safeOperation: { disabledDomains: crawlPolicy.safeOperation.disabledDomains },
            boundaries: {
              requestTimeoutMs: crawlPolicy.boundaries.requestTimeoutMs,
              maxResponseBodyBytes: crawlPolicy.boundaries.maxResponseBodyBytes,
              maxRedirects: crawlPolicy.boundaries.maxRedirects,
              maxAttemptsAvailabilityCritical:
                crawlPolicy.boundaries.maxAttemptsAvailabilityCritical,
              allowedSchemes: crawlPolicy.boundaries.allowedSchemes,
            },
            robotsAndIdentification: { userAgent: crawlPolicy.robotsAndIdentification.userAgent },
          },
          {
            hostScheduler,
            ...(params.ssrf !== undefined ? { ssrf: params.ssrf } : {}),
            now,
            ...(params.sleepFn !== undefined
              ? { retry: { sleepFn: params.sleepFn, randomFn: () => 0 } }
              : {}),
          },
        );
        allLinkObservations.push(...linkObservations);
      }

      if (result.status === "succeeded") {
        succeeded += 1;
      } else if (result.status === "partial") {
        partial += 1;
      } else {
        failed += 1;
      }
      const plannedNote = params.dryRun ? ` (planned: ${result.plannedUrls.length})` : "";
      lines.push(
        `  [${result.status}] ${portal.id} — ${result.pagesFetched} page(s)${plannedNote}`,
      );
      process.stderr.write(
        `[crawl] (${portalIndex}/${portals.length}) [${result.status}] ${portal.id} — ${result.pagesFetched} page(s) in ${Date.now() - portalStartedAt}ms\n`,
      );
    } catch (error) {
      failed += 1;
      lines.push(
        `  [failed] ${portal.id} — unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.stderr.write(
        `[crawl] (${portalIndex}/${portals.length}) [failed] ${portal.id} — unexpected error after ${Date.now() - portalStartedAt}ms: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  // Session 6: the browser (if ever launched) must be closed on every exit
  // path from here on — ephemeral per section 12.1, never left running
  // past the end of the run that launched it.
  async function finish<T extends RunCrawlResult>(result: T): Promise<T> {
    await browserManager.close();
    return result;
  }

  if (params.dryRun) {
    return finish({ ok: true, dryRun: true, lines });
  }

  const completedAt = now();
  // Must mirror `auditRunSchema`'s own invariant exactly (packages/schema/src/
  // audit-run.ts): "completed" requires every portal succeeded;
  // "failed" requires portalsSucceeded === 0 (a portal-level "partial"
  // outcome, with zero full successes, still rolls up to run-level
  // "failed" per the schema's literal definition — a bug fixed this
  // session: the previous derivation compared `failed === portals.length`
  // instead of `succeeded === 0`, which produced a schema-invalid
  // "partial" run status whenever a single-portal run's only portal came
  // back "partial" itself).
  const status: AuditRun["status"] =
    succeeded === portals.length && portals.length > 0
      ? "completed"
      : succeeded === 0
        ? "failed"
        : "partial";

  const codeRevision = getCodeRevision(params.repoRoot);
  const manifest = buildAuditRun({
    runId,
    startedAt,
    completedAt,
    status,
    ...(codeRevision !== undefined ? { codeRevision } : {}),
    sourceRegistry: sourceRegistryResult.value,
    crawlPolicy,
    checksConfig: checksResult.value,
    portalCount: portals.length,
    portalsSucceeded: succeeded,
    portalsFailed: failed,
    portalsPartial: partial,
    limitations,
  });

  const manifestCheck = auditRunSchema.safeParse(manifest);
  if (!manifestCheck.success) {
    return finish({
      ok: false,
      lines: [
        "crawl FAILED — generated AuditRun manifest failed schema validation (this indicates a bug, not a crawl-target problem):",
        manifestCheck.error.message,
      ],
    });
  }
  for (const obs of allPageObservations) {
    const check = pageObservationSchema.safeParse(obs);
    if (!check.success) {
      return finish({
        ok: false,
        lines: [
          `crawl FAILED — generated PageObservation "${obs.id}" failed schema validation: ${check.error.message}`,
        ],
      });
    }
  }
  for (const obs of allLinkObservations) {
    const check = linkObservationSchema.safeParse(obs);
    if (!check.success) {
      return finish({
        ok: false,
        lines: [
          `crawl FAILED — generated LinkObservation "${obs.id}" failed schema validation: ${check.error.message}`,
        ],
      });
    }
  }
  for (const artifact of allEvidenceArtifacts) {
    const check = evidenceArtifactSchema.safeParse(artifact);
    if (!check.success) {
      return finish({
        ok: false,
        lines: [
          `crawl FAILED — generated EvidenceArtifact "${artifact.id}" failed schema validation: ${check.error.message}`,
        ],
      });
    }
  }

  let outputDir: string;
  try {
    ({ outputDir } = writeCrawlRunAtomic({
      outDir: params.crawlOutDir,
      runId,
      manifest,
      pageObservations: allPageObservations,
      linkObservations: allLinkObservations,
      evidenceArtifacts: allEvidenceArtifacts,
      skipLog: allSkipLog,
    }));
  } catch (error) {
    return finish({ ok: false, lines: [error instanceof Error ? error.message : String(error)] });
  }

  lines.push(
    `status: ${status}`,
    `portals succeeded/partial/failed: ${succeeded}/${partial}/${failed}`,
    `page observations: ${allPageObservations.length}`,
    `link observations: ${allLinkObservations.length}`,
    `evidence artifacts: ${allEvidenceArtifacts.length}`,
    `browser fallback used: ${anyBrowserFallbackUsed}`,
    `output: ${outputDir}`,
  );

  return finish({ ok: true, dryRun: false, runId, manifest, outputDir, lines });
}
