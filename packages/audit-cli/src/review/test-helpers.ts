import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Portal } from "@panchnama/schema";
import { runCrawlCommand } from "../commands/crawl.js";
import { runAnalyzeCommand } from "../commands/analyze.js";
import {
  startFixtureServer,
  type FixtureHandler,
  type FixtureServer,
} from "../crawl/testing/fixture-server.js";
import type { ReviewPaths } from "./paths.js";

/**
 * Test-only helper shared by `review/*.test.ts` and `commands/*.test.ts` —
 * builds a real analysis run (via real local fixture HTTP servers, the
 * real `crawl` and `analyze` commands) so review/publish pipeline tests
 * exercise genuine end-to-end input instead of hand-typed `Finding`
 * fixtures that could drift from what `analyze` actually produces.
 */

const SOURCES_YAML = `
schemaVersion: "1.0.0"
geography: assam
sources:
  - id: test-source
    name: Test Source
    authorityName: Test Authority
    url: "https://example.org/directory"
    sourceType: official_directory
    enabled: true
`;

function crawlPolicyYaml(): string {
  return `
schemaVersion: "1.0.0"
boundaries:
  maxPagesPerPortal: 10
  maxDepth: 2
  maxConcurrentRequestsPerHost: 4
  minDelayMsPerHost: 0
  requestTimeoutMs: 1000
  maxAttemptsAvailabilityCritical: 3
  maxResponseBodyBytes: 1048576
  maxRedirects: 10
  allowedSchemes: [http, https]
exclusions:
  routeCategories: []
  denylistPathPatterns: []
  excludedUrlSchemes: [mailto, tel, javascript, data]
robotsAndIdentification:
  userAgent: "PanchnamaTestBot/0.1 (+https://example.org/about)"
  contactUrl: "https://example.org/about"
  respectRobotsTxt: true
jsRendering:
  browserFallbackEnabled: false
  perPortalAllowlist: []
  maxBrowserPagesPerPortal: 5
  maxBrowserResourceBytes: 1048576
urlNormalization:
  trailingSlashPolicy: strip
  removeFragments: true
  trackingParameterDenylist: [utm_source]
  sortRetainedQueryParameters: true
safeOperation:
  globalKillSwitch: false
  disabledDomains: []
  allowedHttpMethods: [GET, HEAD]
`;
}

const CHECKS_YAML = `
schemaVersion: "1.0.0"
checks:
  - ruleId: availability.unavailable.v1
    enabled: true
    parameters:
      spacedAttempts: 3
      minSpacingMinutes: 15
  - ruleId: availability.server-error.v1
    enabled: true
    parameters:
      minRepeatedOccurrences: 2
  - ruleId: availability.not-found.v1
    enabled: true
    parameters:
      minRepeatedOccurrences: 2
  - ruleId: redirect.cross-domain.v1
    enabled: true
    parameters: {}
  - ruleId: availability.automation-blocked.v1
    enabled: true
    parameters: {}
  - ruleId: availability.access-restricted.v1
    enabled: true
    parameters: {}
  - ruleId: broken_link.repeated-failure.v1
    enabled: true
    parameters: {}
  - ruleId: https.certificate-failure.v1
    enabled: true
    parameters: {}
  - ruleId: https.no-tls-upgrade.v1
    enabled: true
    parameters: {}
  - ruleId: freshness.no-signal.v1
    enabled: true
    parameters: {}
  - ruleId: directory_mismatch.unavailable-destination.v1
    enabled: true
    parameters: {}
  - ruleId: directory_mismatch.listed-vs-observed.v1
    enabled: true
    parameters: {}
  - ruleId: directory_mismatch.official-portal-not-listed.v1
    enabled: true
    parameters: {}
  - ruleId: crawl_coverage.summary.v1
    enabled: true
    parameters: {}
`;

function writeConfig(configDir: string): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, "sources.assam.yaml"), SOURCES_YAML, "utf8");
  writeFileSync(join(configDir, "crawl-policy.yaml"), crawlPolicyYaml(), "utf8");
  writeFileSync(join(configDir, "checks.yaml"), CHECKS_YAML, "utf8");
}

export function makeTestPortal(id: string, canonicalUrl: string, hostnames: string[]): Portal {
  return {
    id,
    schemaVersion: "1.0.0",
    name: `Portal ${id}`,
    canonicalUrl,
    alternateUrls: [],
    hostnames,
    geography: "assam",
    portalType: "information",
    officialStatus: "verified",
    sourceRefs: ["test-source"],
    discovery: [
      {
        discoveredAt: "2026-01-01T00:00:00Z",
        discoveredFromUrl: "https://example.org/",
        discoveryMethod: "manual",
      },
    ],
    tags: [],
  };
}

function writeInventory(inventoryOutDir: string, runId: string, portals: Portal[]): void {
  const runDir = join(inventoryOutDir, runId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, "portals.json"), JSON.stringify(portals, null, 2), "utf8");
  writeFileSync(
    join(runDir, "sources.json"),
    JSON.stringify(
      [
        {
          id: "test-source",
          schemaVersion: "1.0.0",
          name: "Test Source",
          authorityName: "Test Authority",
          url: "https://example.org/directory",
          sourceType: "official_directory",
          retrievedAt: "2026-01-01T00:00:00Z",
        },
      ],
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(inventoryOutDir, "latest"), `${runId}\n`, "utf8");
}

export function htmlPage(links: string[] = []): string {
  return `<html><body>${links.map((l) => `<a href="${l}">l</a>`).join("")}</body></html>`;
}

export interface TestRunLayout {
  workDir: string;
  configDir: string;
  inventoryOutDir: string;
  crawlOutDir: string;
  analysisOutDir: string;
  evidenceOutDir: string;
  reviewPaths: ReviewPaths;
  runId: string;
  inventoryRunId: string;
}

/** Runs a real `crawl` then `analyze` against local fixture HTTP servers
 * for the given portals, returning every directory the review/publish
 * pipeline needs. Caller is responsible for starting/closing any
 * `FixtureServer`s it passes canonical URLs for. */
export async function buildAnalyzedRun(params: {
  workDir: string;
  portals: Portal[];
  runId?: string;
  now?: () => string;
}): Promise<TestRunLayout> {
  const workDir = params.workDir;
  const configDir = join(workDir, "config");
  const inventoryOutDir = join(workDir, "inventory");
  const crawlOutDir = join(workDir, "crawl");
  const analysisOutDir = join(workDir, "analysis");
  const evidenceOutDir = join(workDir, "evidence");
  const reviewRoot = join(workDir, "review");
  writeConfig(configDir);

  const inventoryRunId = "assam-20260101T000000Z";
  writeInventory(inventoryOutDir, inventoryRunId, params.portals);

  const runId = params.runId ?? "assam-2026-09-15-r1";

  const crawlResult = await runCrawlCommand({
    configDir,
    inventoryOutDir,
    crawlOutDir,
    repoRoot: workDir,
    runId,
    ssrf: { allowLoopbackForTests: true },
    sleepFn: async () => {},
    now: params.now ?? (() => "2026-09-15T00:00:00Z"),
  });
  if (crawlResult.exitCode !== 0) {
    throw new Error(`test setup: crawl failed: ${crawlResult.lines.join("\n")}`);
  }

  const analyzeResult = await runAnalyzeCommand({
    configDir,
    crawlOutDir,
    inventoryOutDir,
    analysisOutDir,
    evidenceOutDir,
    runId,
    now: params.now ?? (() => "2026-09-15T01:00:00Z"),
  });
  if (analyzeResult.exitCode !== 0) {
    throw new Error(`test setup: analyze failed: ${analyzeResult.lines.join("\n")}`);
  }

  // `reviewPaths(repoRoot)` derives `data/review`/`data/published` under a
  // repo root — here we want them directly under our test workDir's
  // `review` root, so build the layout explicitly instead of nesting an
  // extra `data/` level.
  const layout: TestRunLayout = {
    workDir,
    configDir,
    inventoryOutDir,
    crawlOutDir,
    analysisOutDir,
    evidenceOutDir,
    reviewPaths: {
      reviewDir: reviewRoot,
      decisionsDir: join(reviewRoot, "decisions"),
      evidencePrivacyDir: join(reviewRoot, "evidence-privacy"),
      overlapComparisonsDir: join(reviewRoot, "overlap-comparisons"),
      publishedDir: join(workDir, "published"),
    },
    runId,
    inventoryRunId,
  };
  return layout;
}

export async function withFixtureServer<T>(
  handler: FixtureHandler,
  fn: (server: FixtureServer) => Promise<T>,
): Promise<T> {
  const server = await startFixtureServer(handler);
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}
