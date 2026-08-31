import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  auditRunSchema,
  evidenceArtifactSchema,
  findingSchema,
  inventorySourceSchema,
  linkObservationSchema,
  pageObservationSchema,
  portalSchema,
  technicalHealthSchema,
  type AuditRun,
  type EvidenceArtifact,
  type Finding,
  type InventorySource,
  type LinkObservation,
  type PageObservation,
  type Portal,
  type TechnicalHealth,
} from "@panchnama/schema";
import {
  deriveProvisionalTechnicalHealth,
  selectEnabledRules,
  runPortalRules,
  type AnalysisContext,
} from "@panchnama/audit-core";
import {
  checksConfigSchema,
  crawlPolicyConfigSchema,
  loadYamlConfig,
  type ChecksConfig,
  type CrawlPolicyConfig,
} from "../config/index.js";
import { readLatestCrawlRunId } from "../crawl/write.js";
import { readLatestRunId as readLatestInventoryRunId } from "../inventory/write.js";
import { materializeFindingDraft } from "./materialize.js";
import { writeAnalysisRunAtomic, type AnalyzeManifest } from "./write.js";

export interface RunAnalyzeParams {
  configDir: string;
  crawlOutDir: string;
  inventoryOutDir: string;
  analysisOutDir: string;
  evidenceOutDir: string;
  /** Explicit crawl run id to analyze; defaults to the latest crawl run. */
  runId?: string;
  /** Which inventory build's Portal/InventorySource records to load;
   * defaults to the inventory run referenced by the crawl run's own
   * manifest lookup convention (the latest inventory build, matching
   * `crawl`'s own default). */
  inventoryRunId?: string;
  now?: () => string;
  overwrite?: boolean;
}

export interface RunAnalyzeFailure {
  ok: false;
  lines: string[];
}

export interface RunAnalyzeSuccess {
  ok: true;
  runId: string;
  outputDir: string;
  findingCount: number;
  lines: string[];
}

export type RunAnalyzeResult = RunAnalyzeFailure | RunAnalyzeSuccess;

function readJsonl<T>(
  path: string,
  schema: z.ZodType<T>,
): { ok: true; values: T[] } | { ok: false; error: string } {
  if (!existsSync(path)) {
    return { ok: true, values: [] };
  }
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const values: T[] = [];
  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      return {
        ok: false,
        error: `invalid JSON line in ${path}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return { ok: false, error: `schema validation failed in ${path}: ${result.error.message}` };
    }
    values.push(result.data);
  }
  return { ok: true, values };
}

/**
 * `pnpm run audit analyze --run-id <id>` — implementation.md section 9.1,
 * section 14 Session 7. Loads a crawl run's `AuditRun`/`PageObservation`/
 * `LinkObservation`/`EvidenceArtifact` output (plus the referenced
 * inventory run, for directory-mismatch/broken-link cross-referencing),
 * loads `config/checks.yaml` and `config/crawl-policy.yaml`, runs every
 * enabled rule this package's registry implements, materializes
 * `Finding`/`EvidenceArtifact` records, and writes them atomically to
 * `data/raw/analysis/<runId>/` (documented choice, mirroring
 * `data/raw/crawl/<runId>/` and `data/raw/inventory/<runId>/`).
 */
export async function runAnalyze(params: RunAnalyzeParams): Promise<RunAnalyzeResult> {
  const now = params.now ?? (() => new Date().toISOString());

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

  const runId = params.runId ?? readLatestCrawlRunId(params.crawlOutDir);
  if (runId === undefined) {
    return {
      ok: false,
      lines: [
        "analyze FAILED — no crawl run found. Run `pnpm run audit crawl --state assam` first, or pass --run-id.",
      ],
    };
  }
  const crawlRunDir = join(params.crawlOutDir, runId);
  if (!existsSync(crawlRunDir)) {
    return {
      ok: false,
      lines: [`analyze FAILED — no crawl run output found at "${crawlRunDir}".`],
    };
  }

  const manifestPath = join(crawlRunDir, "manifest.json");
  let auditRun: AuditRun;
  try {
    const parsed = auditRunSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf8")));
    if (!parsed.success) {
      return {
        ok: false,
        lines: [
          `analyze FAILED — ${manifestPath} failed schema validation: ${parsed.error.message}`,
        ],
      };
    }
    auditRun = parsed.data;
  } catch (error) {
    return {
      ok: false,
      lines: [
        `analyze FAILED — could not read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const pageObsResult = readJsonl<PageObservation>(
    join(crawlRunDir, "page-observations.jsonl"),
    pageObservationSchema,
  );
  if (!pageObsResult.ok) return { ok: false, lines: [`analyze FAILED — ${pageObsResult.error}`] };
  const linkObsResult = readJsonl<LinkObservation>(
    join(crawlRunDir, "link-observations.jsonl"),
    linkObservationSchema,
  );
  if (!linkObsResult.ok) return { ok: false, lines: [`analyze FAILED — ${linkObsResult.error}`] };

  const skipLogPath = join(crawlRunDir, "skip-log.json");
  let skipLog: { portalId: string; url: string; depth: number; reason: string }[] = [];
  if (existsSync(skipLogPath)) {
    try {
      skipLog = JSON.parse(readFileSync(skipLogPath, "utf8"));
    } catch {
      skipLog = [];
    }
  }

  const inventoryRunId = params.inventoryRunId ?? readLatestInventoryRunId(params.inventoryOutDir);
  if (inventoryRunId === undefined) {
    return {
      ok: false,
      lines: [
        "analyze FAILED — no inventory build found to load Portal/InventorySource records from. Run `pnpm run audit inventory:build --state assam` first.",
      ],
    };
  }
  const inventoryDir = join(params.inventoryOutDir, inventoryRunId);
  let portals: Portal[];
  let inventorySources: InventorySource[];
  try {
    const portalsParsed = z
      .array(portalSchema)
      .safeParse(JSON.parse(readFileSync(join(inventoryDir, "portals.json"), "utf8")));
    if (!portalsParsed.success) {
      return {
        ok: false,
        lines: [
          `analyze FAILED — portals.json failed schema validation: ${portalsParsed.error.message}`,
        ],
      };
    }
    portals = portalsParsed.data;
    const sourcesParsed = z
      .array(inventorySourceSchema)
      .safeParse(JSON.parse(readFileSync(join(inventoryDir, "sources.json"), "utf8")));
    if (!sourcesParsed.success) {
      return {
        ok: false,
        lines: [
          `analyze FAILED — sources.json failed schema validation: ${sourcesParsed.error.message}`,
        ],
      };
    }
    inventorySources = sourcesParsed.data;
  } catch (error) {
    return {
      ok: false,
      lines: [
        `analyze FAILED — could not read inventory run "${inventoryRunId}": ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  // Scope to portals actually present in this crawl run (a scoped
  // `--portal` crawl only produced observations for one portal).
  const crawledPortalIds = new Set(pageObsResult.values.map((o) => o.portalId));
  const scopedPortals =
    crawledPortalIds.size > 0 ? portals.filter((p) => crawledPortalIds.has(p.id)) : portals;

  const enabledChecks = checksResult.value.checks.map((c) => ({
    ruleId: c.ruleId,
    enabled: c.enabled,
    parameters: c.parameters,
  }));
  const selected = selectEnabledRules(enabledChecks);
  const implementedRuleIds = new Set(selected.map((s) => s.rule.ruleId));
  const unimplementedEnabledRuleIds = enabledChecks
    .filter((c) => c.enabled && !implementedRuleIds.has(c.ruleId))
    .map((c) => c.ruleId);

  const analyzedAt = now();
  const context: AnalysisContext = {
    runId,
    analyzedAt,
    allPortals: portals,
    inventorySources,
    crawlBoundaries: {
      maxPagesPerPortal: crawlPolicyResult.value.boundaries.maxPagesPerPortal,
      maxDepth: crawlPolicyResult.value.boundaries.maxDepth,
    },
  };

  const findings: Finding[] = [];
  const evidenceArtifacts: EvidenceArtifact[] = [];
  const provisionalTechnicalHealth: Record<string, TechnicalHealth> = {};

  for (const portal of scopedPortals) {
    const portalPageObs = pageObsResult.values.filter((o) => o.portalId === portal.id);
    const portalLinkObs = linkObsResult.values.filter((o) => o.portalId === portal.id);
    const portalSkipLog = skipLog
      .filter((s) => s.portalId === portal.id)
      .map((s) => ({ url: s.url, depth: s.depth, reason: s.reason }));

    const drafts = runPortalRules(
      {
        portal,
        pageObservations: portalPageObs,
        linkObservations: portalLinkObs,
        skipLog: portalSkipLog,
      },
      context,
      selected,
    );

    for (const draft of drafts) {
      const { finding, evidence } = materializeFindingDraft(draft, {
        runId,
        evidenceOutDir: params.evidenceOutDir,
        now,
      });
      findings.push(finding);
      evidenceArtifacts.push(...evidence);
    }

    const health = deriveProvisionalTechnicalHealth(drafts);
    const healthCheck = technicalHealthSchema.safeParse(health);
    provisionalTechnicalHealth[portal.id] = healthCheck.success
      ? healthCheck.data
      : "not_assessable";
  }

  // Schema-validate every generated record before writing anything —
  // matches `crawl`'s own "validate before atomic write" convention.
  for (const finding of findings) {
    const check = findingSchema.safeParse(finding);
    if (!check.success) {
      return {
        ok: false,
        lines: [
          `analyze FAILED — generated Finding "${finding.id}" failed schema validation: ${check.error.message}`,
        ],
      };
    }
  }
  for (const artifact of evidenceArtifacts) {
    const check = evidenceArtifactSchema.safeParse(artifact);
    if (!check.success) {
      return {
        ok: false,
        lines: [
          `analyze FAILED — generated EvidenceArtifact "${artifact.id}" failed schema validation: ${check.error.message}`,
        ],
      };
    }
  }
  // Cross-check: every Finding.evidenceRefs value must resolve to one of
  // the EvidenceArtifact records this run just produced (implementation.md
  // section 14 Session 7's exit criterion).
  const evidenceIds = new Set(evidenceArtifacts.map((e) => e.id));
  for (const finding of findings) {
    for (const ref of finding.evidenceRefs) {
      if (!evidenceIds.has(ref)) {
        return {
          ok: false,
          lines: [
            `analyze FAILED — Finding "${finding.id}" cites evidenceRef "${ref}" that does not resolve to a materialized EvidenceArtifact (this indicates a bug, not a data problem).`,
          ],
        };
      }
    }
  }

  const manifest: AnalyzeManifest = {
    runId,
    crawlRunId: runId,
    inventoryRunId,
    analyzedAt,
    enabledRuleIds: selected.map((s) => s.rule.ruleId),
    unimplementedEnabledRuleIds,
    checkConfigDigest: auditRun.checkConfigDigest,
    portalCount: scopedPortals.length,
    findingCount: findings.length,
    evidenceArtifactCount: evidenceArtifacts.length,
    limitations: [
      "This run's technical-health values are PROVISIONAL and pre-review: they are computed from candidate (not yet human-reviewed) findings, and are not the final published TechnicalHealth (see provisional-technical-health.json and technical-health.ts's own doc comment).",
      '"Spaced attempts" for availability rules use within-run retry counts as a documented proxy for checks spread over time — true multi-run temporal spacing is not implemented this session.',
      'Freshness-signal extraction emits only "no_freshness_signal" for every entry page — PageObservation does not persist raw page text at this session\'s boundary, so no content-level freshness extraction was performed.',
      'Broken-link severity elevation uses the linking portal\'s own inventory-source type as a proxy for "link from an official directory," not per-link directory provenance (not tracked at the LinkObservation level).',
      '"Multiple directory entries appear to represent the same portal" (section 7.5) is not detected this session.',
      "No rule in this registry emits a possible_overlap finding — section 7.6's manual-review-first workflow is Session 8's job.",
    ],
  };

  const runIdOutput = runId;
  let outputDir: string;
  try {
    ({ outputDir } = writeAnalysisRunAtomic({
      outDir: params.analysisOutDir,
      runId: runIdOutput,
      manifest,
      findings,
      evidenceArtifacts,
      provisionalTechnicalHealth,
      ...(params.overwrite !== undefined ? { overwrite: params.overwrite } : {}),
    }));
  } catch (error) {
    return { ok: false, lines: [error instanceof Error ? error.message : String(error)] };
  }

  const lines = [
    `analyze run: ${runIdOutput}`,
    `crawl run: ${runId}`,
    `inventory run: ${inventoryRunId}`,
    `portals analyzed: ${scopedPortals.length}`,
    `rules enabled and implemented: ${selected.length}`,
    ...(unimplementedEnabledRuleIds.length > 0
      ? [`rules enabled but NOT implemented (skipped): ${unimplementedEnabledRuleIds.join(", ")}`]
      : []),
    `findings: ${findings.length}`,
    `evidence artifacts: ${evidenceArtifacts.length}`,
    `output: ${outputDir}`,
  ];

  return { ok: true, runId: runIdOutput, outputDir, findingCount: findings.length, lines };
}
