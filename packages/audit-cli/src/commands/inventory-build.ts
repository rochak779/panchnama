import { computeInventoryBuild } from "../inventory/build.js";
import { writeInventoryBuildAtomic } from "../inventory/write.js";

/**
 * `pnpm run audit inventory:build --state assam` — implementation.md
 * section 9.1/9.2, section 14 Session 3.
 *
 * Loads and validates `config/sources.assam.yaml` and
 * `config/crawl-policy.yaml` (reusing Session 2's loader/schemas), runs
 * each configured source's seed adapter (per
 * `data/seed/source-inputs.json`), normalizes/dedupes/merges candidates
 * into provenance-annotated `Portal` records, and writes the result
 * atomically to `data/raw/inventory/<runId>/`. No network activity.
 */
export interface InventoryBuildCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

export function runInventoryBuild(params: {
  configDir: string;
  seedDir: string;
  outDir: string;
  now?: () => string;
}): InventoryBuildCommandOutput {
  const computed = computeInventoryBuild({
    configDir: params.configDir,
    seedDir: params.seedDir,
    ...(params.now !== undefined ? { now: params.now } : {}),
  });

  if (!computed.ok) {
    return {
      exitCode: 1,
      lines: [
        `inventory:build FAILED — ${computed.issues.length} issue(s):`,
        ...computed.issues.map((i) => `  - ${i}`),
      ],
    };
  }

  let outputDir: string;
  try {
    ({ outputDir } = writeInventoryBuildAtomic({
      outDir: params.outDir,
      runId: computed.runId,
      nowIso: computed.nowIso,
      portals: computed.portals,
      inventorySources: computed.inventorySources,
      candidates: computed.candidates,
      warnings: computed.warnings,
    }));
  } catch (error) {
    return {
      exitCode: 1,
      lines: [
        "inventory:build FAILED",
        `  - ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const rejectedCount = computed.candidates.filter((c) => c.rejectedReason !== undefined).length;
  const lines = [
    "inventory:build PASSED",
    `  runId: ${computed.runId}`,
    `  portals: ${computed.portals.length}`,
    `  inventory sources: ${computed.inventorySources.length}`,
    `  rejected/malformed candidates: ${rejectedCount}`,
    `  output: ${outputDir}`,
    `  report: ${outputDir}/report.md`,
  ];
  for (const warning of computed.warnings) {
    lines.push(`  warning: ${warning}`);
  }
  return { exitCode: 0, lines };
}
