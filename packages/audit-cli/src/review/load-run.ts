import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  auditRunSchema,
  evidenceArtifactSchema,
  findingSchema,
  inventorySourceSchema,
  portalSchema,
  type AuditRun,
  type EvidenceArtifact,
  type Finding,
  type InventorySource,
  type Portal,
} from "@panchnama/schema";

export interface AnalyzeManifestShape {
  runId: string;
  crawlRunId: string;
  inventoryRunId: string;
  analyzedAt: string;
  limitations: string[];
  [key: string]: unknown;
}

export interface LoadedRunBundle {
  runId: string;
  analysisManifest: AnalyzeManifestShape;
  findings: Finding[];
  evidenceArtifacts: EvidenceArtifact[];
  auditRun: AuditRun;
  portals: Portal[];
  inventorySources: InventorySource[];
}

export type LoadRunResult = { ok: true; bundle: LoadedRunBundle } | { ok: false; lines: string[] };

function readJsonlSchema<T>(
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
 * Loads everything `review:validate`/`publish` need for one analysis run:
 * the run's candidate `Finding[]`/`EvidenceArtifact[]`, the analysis
 * manifest, the referenced crawl run's `AuditRun` record (for
 * `methodologyVersion`/`limitations` — §5.14's "every exported result must
 * include audit date, methodology version, and limitations"), and the
 * referenced inventory build's `Portal[]`/`InventorySource[]` (for the
 * cross-record portal-existence and source-provenance checks).
 */
export function loadRunBundle(params: {
  runId: string;
  analysisOutDir: string;
  crawlOutDir: string;
  inventoryOutDir: string;
}): LoadRunResult {
  const analysisDir = join(params.analysisOutDir, params.runId);
  if (!existsSync(analysisDir)) {
    return {
      ok: false,
      lines: [
        `no analysis run output found at "${analysisDir}". Run \`analyze --run-id ${params.runId}\` first.`,
      ],
    };
  }

  let analysisManifest: AnalyzeManifestShape;
  try {
    analysisManifest = JSON.parse(readFileSync(join(analysisDir, "manifest.json"), "utf8"));
  } catch (error) {
    return {
      ok: false,
      lines: [
        `could not read ${join(analysisDir, "manifest.json")}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const findingsResult = readJsonlSchema<Finding>(
    join(analysisDir, "findings.jsonl"),
    findingSchema,
  );
  if (!findingsResult.ok) return { ok: false, lines: [findingsResult.error] };
  const evidenceResult = readJsonlSchema<EvidenceArtifact>(
    join(analysisDir, "evidence-artifacts.jsonl"),
    evidenceArtifactSchema,
  );
  if (!evidenceResult.ok) return { ok: false, lines: [evidenceResult.error] };

  const crawlManifestPath = join(params.crawlOutDir, analysisManifest.crawlRunId, "manifest.json");
  if (!existsSync(crawlManifestPath)) {
    return {
      ok: false,
      lines: [`referenced crawl run manifest not found at "${crawlManifestPath}"`],
    };
  }
  let auditRun: AuditRun;
  try {
    const parsed = auditRunSchema.safeParse(JSON.parse(readFileSync(crawlManifestPath, "utf8")));
    if (!parsed.success) {
      return {
        ok: false,
        lines: [`${crawlManifestPath} failed schema validation: ${parsed.error.message}`],
      };
    }
    auditRun = parsed.data;
  } catch (error) {
    return {
      ok: false,
      lines: [
        `could not read ${crawlManifestPath}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const inventoryDir = join(params.inventoryOutDir, analysisManifest.inventoryRunId);
  let portals: Portal[];
  let inventorySources: InventorySource[];
  try {
    const portalsParsed = z
      .array(portalSchema)
      .safeParse(JSON.parse(readFileSync(join(inventoryDir, "portals.json"), "utf8")));
    if (!portalsParsed.success) {
      return {
        ok: false,
        lines: [`portals.json failed schema validation: ${portalsParsed.error.message}`],
      };
    }
    portals = portalsParsed.data;
    const sourcesParsed = z
      .array(inventorySourceSchema)
      .safeParse(JSON.parse(readFileSync(join(inventoryDir, "sources.json"), "utf8")));
    if (!sourcesParsed.success) {
      return {
        ok: false,
        lines: [`sources.json failed schema validation: ${sourcesParsed.error.message}`],
      };
    }
    inventorySources = sourcesParsed.data;
  } catch (error) {
    return {
      ok: false,
      lines: [
        `could not read inventory run "${analysisManifest.inventoryRunId}": ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  return {
    ok: true,
    bundle: {
      runId: params.runId,
      analysisManifest,
      findings: findingsResult.values,
      evidenceArtifacts: evidenceResult.values,
      auditRun,
      portals,
      inventorySources,
    },
  };
}
