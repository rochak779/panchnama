import { join } from "node:path";
import type { AuditRun, PageObservation, Portal } from "@panchnama/schema";
import { portalSchema, pageObservationSchema, auditRunSchema } from "@panchnama/schema";
import { z } from "zod";
import { readFileSync } from "node:fs";
import {
  checksConfigSchema,
  crawlPolicyConfigSchema,
  loadYamlConfig,
  sourceRegistryConfigSchema,
  type ChecksConfig,
  type CrawlPolicyConfig,
  type SourceRegistryConfig,
} from "../config/index.js";
import { readLatestRunId } from "../inventory/write.js";
import { crawlPortal, type SkipLogEntry } from "./frontier.js";
import { HostScheduler } from "./host-scheduler.js";
import { RobotsCache } from "./robots-fetcher.js";
import type { HttpFetcherOptions } from "./http-fetcher.js";
import { buildAuditRun, getCodeRevision } from "./manifest.js";
import { defaultCrawlRunId } from "./id.js";
import { listExistingCrawlRunIds, writeCrawlRunAtomic } from "./write.js";

export interface RunCrawlParams {
  configDir: string;
  inventoryOutDir: string;
  crawlOutDir: string;
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

  const lines: string[] = [
    `crawl run: ${runId}`,
    `inventory: ${inventoryRunId}`,
    `portals: ${portals.length}`,
  ];
  if (params.dryRun) {
    lines.push("mode: --dry-run (no network requests will be made)");
  }

  const allPageObservations: PageObservation[] = [];
  const allSkipLog: SkipLogEntry[] = [];
  let succeeded = 0;
  let failed = 0;
  let partial = 0;
  const limitations: string[] = [
    "Page discovery this session uses a minimal <a href> scan (Session 4/5 boundary); full title/canonical/language/link-context extraction is Session 5's job.",
    "Destination link-checking (verifying discovered links resolve) is Session 5's job — this run only records the pages it visited.",
    "Browser/JavaScript rendering fallback is not implemented (Session 6); client-rendered pages with no server-rendered links will show reduced coverage.",
  ];

  for (const portal of portals) {
    // Section 14 Session 4 exit criterion: "one portal failure does not
    // stop the run" — isolate every portal's crawl in its own try/catch.
    try {
      const result = await crawlPortal(
        portal,
        runId,
        {
          boundaries: crawlPolicy.boundaries,
          exclusions: crawlPolicy.exclusions,
          robotsAndIdentification: crawlPolicy.robotsAndIdentification,
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
        },
      );

      allPageObservations.push(...result.pageObservations);
      allSkipLog.push(...result.skipLog);
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
    } catch (error) {
      failed += 1;
      lines.push(
        `  [failed] ${portal.id} — unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (params.dryRun) {
    return { ok: true, dryRun: true, lines };
  }

  const completedAt = now();
  const status: AuditRun["status"] =
    failed === portals.length && portals.length > 0
      ? "failed"
      : succeeded === portals.length
        ? "completed"
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
    return {
      ok: false,
      lines: [
        "crawl FAILED — generated AuditRun manifest failed schema validation (this indicates a bug, not a crawl-target problem):",
        manifestCheck.error.message,
      ],
    };
  }
  for (const obs of allPageObservations) {
    const check = pageObservationSchema.safeParse(obs);
    if (!check.success) {
      return {
        ok: false,
        lines: [
          `crawl FAILED — generated PageObservation "${obs.id}" failed schema validation: ${check.error.message}`,
        ],
      };
    }
  }

  let outputDir: string;
  try {
    ({ outputDir } = writeCrawlRunAtomic({
      outDir: params.crawlOutDir,
      runId,
      manifest,
      pageObservations: allPageObservations,
      skipLog: allSkipLog,
    }));
  } catch (error) {
    return { ok: false, lines: [error instanceof Error ? error.message : String(error)] };
  }

  lines.push(
    `status: ${status}`,
    `portals succeeded/partial/failed: ${succeeded}/${partial}/${failed}`,
    `page observations: ${allPageObservations.length}`,
    `output: ${outputDir}`,
  );

  return { ok: true, dryRun: false, runId, manifest, outputDir, lines };
}
