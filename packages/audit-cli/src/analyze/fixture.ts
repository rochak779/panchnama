import type { LinkObservation, PageObservation, Portal } from "@panchnama/schema";
import {
  selectEnabledRules,
  runPortalRules,
  deriveProvisionalTechnicalHealth,
  type AnalysisContext,
} from "@panchnama/audit-core";
import { checksConfigSchema, loadYamlConfig, type ChecksConfig } from "../config/index.js";
import { join } from "node:path";

/**
 * `pnpm run audit analyze --portal <portal-id> --fixture` — implementation.md
 * section 9.1's literal listed dev command. Interpretation (documented
 * judgment call): "fixture" means running the rule registry against a
 * small, deterministic, BUILT-IN observation set for one synthetic portal
 * (not real crawl output on disk) — useful for fast rule-authoring
 * iteration without needing a live crawl run first. `--portal <portal-id>`
 * only labels the synthetic portal's id in the output; it does not look up
 * a real inventory record. This command never writes to `data/raw/` — it
 * only prints the resulting candidate findings and provisional technical
 * health to stdout, exactly like every other command's line-based output.
 */
export interface RunAnalyzeFixtureParams {
  configDir: string;
  portalId: string;
  now?: () => string;
}

export interface RunAnalyzeFixtureResult {
  exitCode: 0 | 1;
  lines: string[];
}

function buildFixturePortal(portalId: string): Portal {
  return {
    id: portalId,
    schemaVersion: "1.0.0",
    name: "Fixture Portal",
    canonicalUrl: "https://fixture.assam.gov.in/",
    alternateUrls: [],
    hostnames: ["fixture.assam.gov.in"],
    geography: "assam",
    portalType: "information",
    officialStatus: "unverified",
    sourceRefs: [],
    discovery: [
      {
        discoveredAt: "2026-08-01T00:00:00.000Z",
        discoveredFromUrl: "https://assam.gov.in/directory",
        discoveryMethod: "listed",
      },
    ],
    tags: ["fixture"],
  };
}

function buildFixturePageObservations(portal: Portal): PageObservation[] {
  return [
    {
      id: "fixture-page-1",
      schemaVersion: "1.0.0",
      runId: "fixture-run",
      portalId: portal.id,
      requestedUrl: portal.canonicalUrl,
      checkedAt: "2026-08-01T00:00:00.000Z",
      attempt: 1,
      fetchMode: "http",
      errorCode: "CONNECT_TIMEOUT",
      errorMessage: "connection timed out (fixture)",
      redirectChain: [],
      robotsDecision: "allowed",
      artifactRefs: [],
    },
    {
      id: "fixture-page-2",
      schemaVersion: "1.0.0",
      runId: "fixture-run",
      portalId: portal.id,
      requestedUrl: portal.canonicalUrl,
      checkedAt: "2026-08-01T00:05:00.000Z",
      attempt: 2,
      fetchMode: "http",
      errorCode: "CONNECT_TIMEOUT",
      errorMessage: "connection timed out (fixture)",
      redirectChain: [],
      robotsDecision: "allowed",
      artifactRefs: [],
    },
    {
      id: "fixture-page-3",
      schemaVersion: "1.0.0",
      runId: "fixture-run",
      portalId: portal.id,
      requestedUrl: portal.canonicalUrl,
      checkedAt: "2026-08-01T00:10:00.000Z",
      attempt: 3,
      fetchMode: "http",
      errorCode: "CONNECT_TIMEOUT",
      errorMessage: "connection timed out (fixture)",
      redirectChain: [],
      robotsDecision: "allowed",
      artifactRefs: [],
    },
  ];
}

function buildFixtureLinkObservations(portal: Portal): LinkObservation[] {
  return [
    {
      id: "fixture-link-1",
      schemaVersion: "1.0.0",
      runId: "fixture-run",
      portalId: portal.id,
      sourcePageUrl: portal.canonicalUrl,
      destinationUrl: "https://dead-service.example.com/apply",
      normalizedDestinationUrl: "https://dead-service.example.com/apply",
      relationship: "external",
      checkedAt: "2026-08-01T00:00:00.000Z",
      status: "fail",
      errorCode: "HTTP_SERVER_ERROR",
      attempts: 2,
    },
  ];
}

export async function runAnalyzeFixture(
  params: RunAnalyzeFixtureParams,
): Promise<RunAnalyzeFixtureResult> {
  const now = params.now ?? (() => new Date().toISOString());
  const checksResult = loadYamlConfig<ChecksConfig>(
    join(params.configDir, "checks.yaml"),
    checksConfigSchema,
  );
  if (!checksResult.ok) {
    return {
      exitCode: 1,
      lines: checksResult.issues.map((i) => `${i.file} [${i.path}]: ${i.reason}`),
    };
  }

  const portal = buildFixturePortal(params.portalId);
  const pageObservations = buildFixturePageObservations(portal);
  const linkObservations = buildFixtureLinkObservations(portal);

  const selected = selectEnabledRules(
    checksResult.value.checks.map((c) => ({
      ruleId: c.ruleId,
      enabled: c.enabled,
      parameters: c.parameters,
    })),
  );

  const context: AnalysisContext = {
    runId: "fixture-run",
    analyzedAt: now(),
    allPortals: [portal],
    inventorySources: [],
    crawlBoundaries: { maxPagesPerPortal: 40, maxDepth: 2 },
  };

  const drafts = runPortalRules(
    { portal, pageObservations, linkObservations, skipLog: [] },
    context,
    selected,
  );
  const health = deriveProvisionalTechnicalHealth(drafts);

  const lines: string[] = [
    `analyze --portal ${params.portalId} --fixture`,
    "mode: built-in fixture observation set (no crawl/inventory data read; nothing written to data/raw/)",
    `candidate findings: ${drafts.length}`,
    `provisional technical health: ${health}`,
    "",
    ...drafts.map((d) => JSON.stringify(d)),
  ];

  return { exitCode: 0, lines };
}
