import type { PublishedPortalAssessment } from "@panchnama/schema";
import type { PublicationSummary } from "./transform.js";

function escapeMd(value: string): string {
  return value.replace(/([|`*_[\]])/g, "\\$1");
}

/**
 * Human-readable Markdown summary of a published run — implementation.md
 * section 14 Session 8, `pnpm run audit report --run-id <id>`, matching
 * the "human-reviewable" convention Session 3 established for its
 * inventory report (`inventory/report.ts`). Reads from the already
 * PUBLISHED (reviewed) dataset, not raw analysis output.
 */
export function buildReport(
  assessments: PublishedPortalAssessment[],
  summary: PublicationSummary,
): string {
  const lines: string[] = [];
  lines.push(`# Panchnama audit report — ${summary.runId}`);
  lines.push("");
  lines.push(
    `Independent case-study prototype. Not affiliated with or endorsed by the Government of Assam.`,
  );
  lines.push("");
  lines.push(`- Published at: ${summary.publishedAt}`);
  lines.push(`- Audit date: ${summary.auditDate}`);
  lines.push(`- Methodology version: ${summary.methodologyVersion}`);
  lines.push(`- Portals assessed: ${summary.portalCount}`);
  lines.push("");

  lines.push("## Technical health");
  lines.push("");
  lines.push("| Status | Portals |");
  lines.push("|---|---|");
  for (const [status, count] of Object.entries(summary.technicalHealthCounts).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push("");

  lines.push("## Findings by severity (published, reviewed only)");
  lines.push("");
  lines.push("| Severity | Count |");
  lines.push("|---|---|");
  for (const [severity, count] of Object.entries(summary.severityCounts).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`| ${severity} | ${count} |`);
  }
  lines.push("");

  lines.push("## Suggested actions");
  lines.push("");
  lines.push("| Action | Portals |");
  lines.push("|---|---|");
  for (const [action, count] of Object.entries(summary.suggestedActionCounts).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`| ${action} | ${count} |`);
  }
  lines.push("");

  const priorityFindings = [...assessments]
    .flatMap((a) =>
      a.reviewedFindings
        .filter((f) => f.severity === "critical")
        .map((f) => ({ portal: a.portal.name, finding: f })),
    )
    .sort((a, b) => a.finding.id.localeCompare(b.finding.id));

  lines.push("## Priority findings (critical severity)");
  lines.push("");
  if (priorityFindings.length === 0) {
    lines.push("_No critical-severity findings in this published run._");
  } else {
    for (const { portal, finding } of priorityFindings) {
      lines.push(
        `- **${escapeMd(portal)}** — ${escapeMd(finding.title)}: ${escapeMd(finding.summary)}`,
      );
    }
  }
  lines.push("");

  lines.push("## Limitations");
  lines.push("");
  if (summary.limitations.length === 0) {
    lines.push("_None recorded._");
  } else {
    for (const limitation of summary.limitations) {
      lines.push(`- ${escapeMd(limitation)}`);
    }
  }
  lines.push("");

  lines.push("## Portals");
  lines.push("");
  lines.push(
    "| Portal | Health | Continuing role | Suggested action | Critical | Significant | Advisory |",
  );
  lines.push("|---|---|---|---|---|---|---|");
  for (const a of [...assessments].sort((x, y) => x.portal.id.localeCompare(y.portal.id))) {
    lines.push(
      `| ${escapeMd(a.portal.name)} | ${a.technicalHealth} | ${a.continuingRole} | ${a.suggestedAction} | ${a.criticalFindingCount} | ${a.significantFindingCount} | ${a.advisoryFindingCount} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
