import type { InventorySource, Portal } from "@panchnama/schema";
import { inventorySourceSchema, portalSchema, SCHEMA_VERSIONS } from "@panchnama/schema";
import { normalizeUrl, type UrlNormalizationOptions } from "@panchnama/audit-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  crawlPolicyConfigSchema,
  loadYamlConfig,
  sourceRegistryConfigSchema,
  type CrawlPolicyConfig,
  type SourceRegistryConfig,
} from "../config/index.js";
import { parseCsvSeed } from "./adapters/csv.js";
import { parseHtmlSeed } from "./adapters/html.js";
import { parseJsonSeed } from "./adapters/json.js";
import type { PortalCandidateReference, RejectedCandidate } from "./candidate.js";
import { deriveInventoryRunId } from "./id.js";
import { mergeCandidates, type SourceType } from "./merge.js";
import { loadAliases, loadSourceInputsMap } from "./seed-inputs.js";

export interface BuildInventoryOptions {
  configDir: string;
  seedDir: string;
  /** Defaults to `() => new Date().toISOString()`; overridable so tests
   * and callers can pin the build timestamp. */
  now?: () => string;
}

export interface BuildInventoryFailure {
  ok: false;
  issues: string[];
}

export interface BuildInventoryCandidateRecord {
  sourceId: string;
  name: string;
  originalUrl: string;
  discoveredFromUrl: string;
  discoveryMethod: string;
  normalizedUrl?: string;
  portalId?: string;
  rejectedReason?: string;
}

export interface BuildInventorySuccess {
  ok: true;
  runId: string;
  nowIso: string;
  portals: Portal[];
  inventorySources: InventorySource[];
  candidates: BuildInventoryCandidateRecord[];
  warnings: string[];
}

export type BuildInventoryResult = BuildInventoryFailure | BuildInventorySuccess;

/**
 * Computes (but does not write) one inventory build's output —
 * implementation.md section 14 Session 3. Pure with respect to the
 * filesystem paths given to it: reads `config/sources.assam.yaml`,
 * `config/crawl-policy.yaml`, and the seed fixtures under `seedDir`; never
 * performs network activity (no fetch/HTTP client is imported anywhere in
 * this module).
 *
 * Fails closed (`{ ok: false, issues }`) on: source-registry or
 * crawl-policy config validation failure, an unreadable/invalid
 * `source-inputs.json` or `aliases.json`, or an alias target URL that
 * itself fails to normalize (a reviewed alias is expected to be
 * well-formed).
 */
export function computeInventoryBuild(options: BuildInventoryOptions): BuildInventoryResult {
  const now = options.now ?? (() => new Date().toISOString());
  const nowIso = now();
  const issues: string[] = [];
  const warnings: string[] = [];

  const sourcesResult = loadYamlConfig<SourceRegistryConfig>(
    join(options.configDir, "sources.assam.yaml"),
    sourceRegistryConfigSchema,
  );
  if (!sourcesResult.ok) {
    return {
      ok: false,
      issues: sourcesResult.issues.map((i) => `${i.file} [${i.path}]: ${i.reason}`),
    };
  }
  const sourceRegistry = sourcesResult.value;

  const crawlPolicyResult = loadYamlConfig<CrawlPolicyConfig>(
    join(options.configDir, "crawl-policy.yaml"),
    crawlPolicyConfigSchema,
  );
  if (!crawlPolicyResult.ok) {
    return {
      ok: false,
      issues: crawlPolicyResult.issues.map((i) => `${i.file} [${i.path}]: ${i.reason}`),
    };
  }
  const normalizationOptions: UrlNormalizationOptions = crawlPolicyResult.value.urlNormalization;

  let sourceInputs: ReturnType<typeof loadSourceInputsMap>;
  try {
    sourceInputs = loadSourceInputsMap(options.seedDir);
  } catch (error) {
    return {
      ok: false,
      issues: [`failed to load ${join(options.seedDir, "source-inputs.json")}: ${describeError(error)}`],
    };
  }

  let aliasEntries: ReturnType<typeof loadAliases>;
  try {
    aliasEntries = loadAliases(options.seedDir);
  } catch (error) {
    return {
      ok: false,
      issues: [`failed to load ${join(options.seedDir, "aliases.json")}: ${describeError(error)}`],
    };
  }

  const aliasMap = new Map<string, string>();
  for (const alias of aliasEntries) {
    const fromResult = normalizeUrl(alias.from, normalizationOptions);
    const toResult = normalizeUrl(alias.to, normalizationOptions);
    if (!fromResult.ok) {
      issues.push(
        `${join(options.seedDir, "aliases.json")}: alias 'from' URL is malformed: "${alias.from}" (${fromResult.reason})`,
      );
      continue;
    }
    if (!toResult.ok) {
      issues.push(
        `${join(options.seedDir, "aliases.json")}: alias 'to' URL is malformed: "${alias.to}" (${toResult.reason})`,
      );
      continue;
    }
    aliasMap.set(fromResult.normalizedUrl, toResult.normalizedUrl);
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const enabledSourcesById = new Map(
    sourceRegistry.sources.filter((s) => s.enabled).map((s) => [s.id, s]),
  );

  const sourceTypeById = new Map<string, SourceType>();
  const baseUrlById = new Map<string, string>();
  const usedSourceIds: string[] = [];
  const allCandidates: PortalCandidateReference[] = [];
  /** Rejections that happened inside an adapter (malformed row, missing
   * name/url) — these never became a `PortalCandidateReference`, so they
   * are not otherwise represented in `allCandidates`. */
  const adapterRejected: RejectedCandidate[] = [];

  for (const [sourceId, seedInput] of Object.entries(sourceInputs)) {
    const sourceEntry = enabledSourcesById.get(sourceId);
    if (!sourceEntry) {
      warnings.push(
        `${join(options.seedDir, "source-inputs.json")} references source "${sourceId}", which is not an enabled entry in config/sources.assam.yaml — skipped.`,
      );
      continue;
    }

    sourceTypeById.set(sourceId, sourceEntry.sourceType);
    // Only HTML seed input carries relative hrefs that need a base URL to
    // resolve against (implementation.md section 6.5, "resolve relative
    // URLs"). JSON/CSV seed entries are documented as already-absolute
    // URL fields; deliberately NOT giving them a base means a malformed
    // or accidentally-relative value in those formats is correctly
    // flagged rather than silently "resolving" against the source page
    // (almost any string resolves successfully once a base is supplied,
    // which would defeat malformed-URL detection for those formats).
    if (seedInput.format === "html") {
      baseUrlById.set(sourceId, sourceEntry.url);
    }
    usedSourceIds.push(sourceId);

    const filePath = join(options.seedDir, seedInput.path);
    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (error) {
      return {
        ok: false,
        issues: [
          `failed to read seed input "${filePath}" for source "${sourceId}": ${describeError(error)}`,
        ],
      };
    }

    const adapterContext = {
      sourceId,
      discoveredFromUrl: sourceEntry.url,
      discoveryMethod: seedInput.discoveryMethod,
    };

    const adapterResult =
      seedInput.format === "html"
        ? parseHtmlSeed(content, adapterContext)
        : seedInput.format === "json"
          ? parseJsonSeed(content, adapterContext)
          : parseCsvSeed(content, adapterContext);

    allCandidates.push(...adapterResult.candidates);
    adapterRejected.push(...adapterResult.rejected);
  }

  for (const sourceEntry of sourceRegistry.sources) {
    if (sourceEntry.enabled && !usedSourceIds.includes(sourceEntry.id)) {
      warnings.push(
        `enabled source "${sourceEntry.id}" has no entry in ${join(options.seedDir, "source-inputs.json")} — no candidates were ingested from it this build.`,
      );
    }
  }

  const mergeResult = mergeCandidates({
    candidates: allCandidates,
    sourceTypeById,
    baseUrlById,
    normalizationOptions,
    aliasMap,
    nowIso,
  });

  const inventorySources: InventorySource[] = usedSourceIds.map((sourceId) => {
    const sourceEntry = enabledSourcesById.get(sourceId)!;
    const seedInput = sourceInputs[sourceId]!;
    const record: InventorySource = {
      id: sourceEntry.id,
      schemaVersion: SCHEMA_VERSIONS.inventorySource,
      name: sourceEntry.name,
      authorityName: sourceEntry.authorityName,
      url: sourceEntry.url,
      sourceType: sourceEntry.sourceType,
      retrievedAt: nowIso,
      // Was hardcoded to `data/seed/${seedInput.path}` — silently wrong
      // for any caller passing a non-default --seed-dir (this function
      // is documented as "pure with respect to the filesystem paths
      // given to it"; hardcoding a literal directory name violated
      // that). Session 17 is the first caller to use a real, non-`data/
      // seed` evidence directory, which is what surfaced this.
      evidencePath: join(options.seedDir, seedInput.path),
    };
    if (sourceEntry.notes !== undefined) {
      record.notes = sourceEntry.notes;
    }
    return record;
  });

  // Schema-validate everything before it's considered buildable output —
  // implementation.md section 9.2 ("validate ... then move").
  for (const source of inventorySources) {
    const result = inventorySourceSchema.safeParse(source);
    if (!result.success) {
      issues.push(
        `generated InventorySource "${source.id}" failed schema validation: ${result.error.message}`,
      );
    }
  }
  for (const portal of mergeResult.portals) {
    const result = portalSchema.safeParse(portal);
    if (!result.success) {
      issues.push(
        `generated Portal "${portal.id}" failed schema validation: ${result.error.message}`,
      );
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const portalIdByCanonicalUrl = new Map(mergeResult.portals.map((p) => [p.canonicalUrl, p.id]));
  const candidateRecords: BuildInventoryCandidateRecord[] = [];
  for (const candidate of allCandidates) {
    const base = baseUrlById.get(candidate.sourceId);
    const normResult = normalizeUrl(candidate.url, normalizationOptions, base);
    const record: BuildInventoryCandidateRecord = {
      sourceId: candidate.sourceId,
      name: candidate.name,
      originalUrl: candidate.url,
      discoveredFromUrl: candidate.discoveredFromUrl,
      discoveryMethod: candidate.discoveryMethod,
    };
    if (normResult.ok) {
      record.normalizedUrl = normResult.normalizedUrl;
      const canonicalUrl = aliasMap.get(normResult.normalizedUrl) ?? normResult.normalizedUrl;
      const portalId = portalIdByCanonicalUrl.get(canonicalUrl);
      if (portalId !== undefined) {
        record.portalId = portalId;
      }
    } else {
      record.rejectedReason = normResult.reason;
    }
    candidateRecords.push(record);
  }
  for (const rejectedCandidate of adapterRejected) {
    candidateRecords.push({
      sourceId: rejectedCandidate.sourceId,
      name: String(rejectedCandidate.raw.name ?? "(unknown)"),
      originalUrl: String(rejectedCandidate.raw.url ?? rejectedCandidate.raw.href ?? "(unknown)"),
      discoveredFromUrl: baseUrlById.get(rejectedCandidate.sourceId) ?? "(unknown)",
      discoveryMethod: "(rejected before discovery route was recorded)",
      rejectedReason: rejectedCandidate.reason,
    });
  }

  return {
    ok: true,
    runId: deriveInventoryRunId(nowIso),
    nowIso,
    portals: mergeResult.portals,
    inventorySources,
    candidates: candidateRecords,
    warnings,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
