import type { InventorySource, Portal } from "@panchnama/schema";
import type { BuildInventoryCandidateRecord } from "./build.js";

/**
 * Human-reviewable candidate inventory — implementation.md section 14
 * Session 3: "Output a human-reviewable candidate inventory." Markdown so
 * it renders directly in a PR diff or a plain-text viewer; lists every
 * portal with its official status and discovery route(s)/source(s), plus
 * a separate section for anything rejected during ingestion so a reviewer
 * can see what did NOT make it in and why (nothing is silently dropped).
 */
export function renderInventoryReport(params: {
  runId: string;
  nowIso: string;
  portals: Portal[];
  inventorySources: InventorySource[];
  candidates: BuildInventoryCandidateRecord[];
  warnings: string[];
}): string {
  const { runId, nowIso, portals, inventorySources, candidates, warnings } = params;
  const sourceNameById = new Map(inventorySources.map((s) => [s.id, s.name]));
  const rejected = candidates.filter((c) => c.rejectedReason !== undefined);

  const lines: string[] = [];
  lines.push(`# Panchnama Assam inventory build — ${runId}`);
  lines.push("");
  lines.push(`Built at: ${nowIso}`);
  lines.push("");
  lines.push(
    "This is a pre-review, fixture-driven build (implementation.md Session 3). It is NOT a published/validated dataset — see Session 8 for the review and publication pipeline. All source content in this build is illustrative seed fixture data (see `data/seed/*`), not real crawled content.",
  );
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Portals: ${portals.length}`);
  lines.push(`- Inventory sources ingested: ${inventorySources.length}`);
  lines.push(`- Rejected/malformed candidates: ${rejected.length}`);
  if (warnings.length > 0) {
    lines.push(`- Warnings: ${warnings.length}`);
  }
  lines.push("");

  lines.push("## Inventory sources");
  lines.push("");
  lines.push("| Source ID | Name | Type | URL | Retrieved At |");
  lines.push("|---|---|---|---|---|");
  for (const source of inventorySources) {
    lines.push(
      `| ${source.id} | ${source.name} | ${source.sourceType} | ${source.url} | ${source.retrievedAt} |`,
    );
  }
  lines.push("");

  lines.push("## Portals");
  lines.push("");
  lines.push("| Name | Official status | Canonical URL | Sources | Discovery routes |");
  lines.push("|---|---|---|---|---|");
  for (const portal of [...portals].sort((a, b) => a.name.localeCompare(b.name))) {
    const sourceNames = portal.sourceRefs.map((id) => sourceNameById.get(id) ?? id).join(", ");
    const discoveryRoutes = portal.discovery
      .map((d) => `${d.discoveryMethod} from ${d.discoveredFromUrl}`)
      .join("; ");
    lines.push(
      `| ${portal.name} | ${portal.officialStatus} | ${portal.canonicalUrl} | ${sourceNames} | ${discoveryRoutes} |`,
    );
  }
  lines.push("");

  if (rejected.length > 0) {
    lines.push("## Rejected / malformed candidates (not included above)");
    lines.push("");
    lines.push("| Source | Name | Original URL | Reason |");
    lines.push("|---|---|---|---|");
    for (const candidate of rejected) {
      lines.push(
        `| ${candidate.sourceId} | ${candidate.name} | ${candidate.originalUrl} | ${candidate.rejectedReason} |`,
      );
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
