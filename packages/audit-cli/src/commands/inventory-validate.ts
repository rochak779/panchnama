import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  inventorySourceSchema,
  portalSchema,
  type InventorySource,
  type Portal,
} from "@panchnama/schema";
import { z } from "zod";
import { readLatestRunId } from "../inventory/write.js";

/**
 * `pnpm run audit inventory:validate --state assam [--run-id <id>]` —
 * implementation.md section 9.1/9.2, section 14 Session 3.
 *
 * Validates the most recent (or a specified) `inventory:build` output
 * against the `Portal`/`InventorySource` Zod schemas, plus semantic
 * checks that are only possible once actual records exist (unlike
 * Session 1's deferred cross-record checks):
 *   - every portal has at least one `discovery` route;
 *   - every portal has at least one `sourceRefs` entry, and every
 *     `sourceRefs` entry resolves to a loaded `InventorySource`;
 *   - no duplicate portal `id`s;
 *   - no duplicate `InventorySource` `id`s.
 *
 * Exits non-zero with clear, itemized messages on any failure — no
 * network activity.
 */
export interface InventoryValidateCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

export function runInventoryValidate(params: {
  outDir: string;
  runId?: string;
}): InventoryValidateCommandOutput {
  const runId = params.runId ?? readLatestRunId(params.outDir);
  if (runId === undefined) {
    return {
      exitCode: 1,
      lines: [
        "inventory:validate FAILED",
        "  - no inventory build output found (run inventory:build first, or pass --run-id)",
      ],
    };
  }

  const runDir = join(params.outDir, runId);
  if (!existsSync(runDir)) {
    return {
      exitCode: 1,
      lines: [
        "inventory:validate FAILED",
        `  - inventory build output directory does not exist: ${runDir}`,
      ],
    };
  }

  const portalsPath = join(runDir, "portals.json");
  const sourcesPath = join(runDir, "sources.json");

  const portalsResult = readJsonArray(portalsPath, z.array(portalSchema));
  const sourcesResult = readJsonArray(sourcesPath, z.array(inventorySourceSchema));

  const loadIssues = [
    ...(portalsResult.ok ? [] : portalsResult.issues),
    ...(sourcesResult.ok ? [] : sourcesResult.issues),
  ];
  if (loadIssues.length > 0 || !portalsResult.ok || !sourcesResult.ok) {
    return {
      exitCode: 1,
      lines: [
        `inventory:validate FAILED — ${loadIssues.length} issue(s):`,
        ...loadIssues.map((i) => `  - ${i}`),
      ],
    };
  }

  const issues: string[] = [];
  const portals: Portal[] = portalsResult.value;
  const sources: InventorySource[] = sourcesResult.value;
  const sourceIds = new Set(sources.map((s) => s.id));

  const seenSourceIds = new Set<string>();
  for (const source of sources) {
    if (seenSourceIds.has(source.id)) {
      issues.push(`duplicate InventorySource id: "${source.id}"`);
    }
    seenSourceIds.add(source.id);
  }

  const seenPortalIds = new Set<string>();
  for (const portal of portals) {
    if (seenPortalIds.has(portal.id)) {
      issues.push(`duplicate Portal id: "${portal.id}"`);
    }
    seenPortalIds.add(portal.id);

    if (portal.discovery.length === 0) {
      issues.push(
        `portal "${portal.id}" (${portal.name}) has no discovery route — lost provenance`,
      );
    }
    if (portal.sourceRefs.length === 0) {
      issues.push(`portal "${portal.id}" (${portal.name}) has no sourceRefs — lost provenance`);
    }
    for (const sourceRef of portal.sourceRefs) {
      if (!sourceIds.has(sourceRef)) {
        issues.push(
          `portal "${portal.id}" (${portal.name}) references sourceRef "${sourceRef}", which does not resolve to any loaded InventorySource`,
        );
      }
    }
  }

  if (issues.length > 0) {
    return {
      exitCode: 1,
      lines: [
        `inventory:validate FAILED — ${issues.length} issue(s):`,
        ...issues.map((i) => `  - ${i}`),
      ],
    };
  }

  return {
    exitCode: 0,
    lines: [
      "inventory:validate PASSED",
      `  runId: ${runId}`,
      `  portals: ${portals.length}`,
      `  inventory sources: ${sources.length}`,
    ],
  };
}

type ReadJsonArrayResult<T> = { ok: true; value: T[] } | { ok: false; issues: string[] };

function readJsonArray<T>(filePath: string, schema: z.ZodType<T[]>): ReadJsonArrayResult<T> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    return {
      ok: false,
      issues: [
        `failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      issues: [
        `invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map(
        (issue) =>
          `${filePath} [${issue.path.length > 0 ? issue.path.join(".") : "(root)"}]: ${issue.message}`,
      ),
    };
  }

  return { ok: true, value: result.data };
}
