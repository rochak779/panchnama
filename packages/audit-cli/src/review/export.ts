import type { PublishedPortalAssessment } from "@panchnama/schema";
import type { PublicationSummary } from "./transform.js";
import { buildCsv } from "./csv.js";

/**
 * Export scope for this session (documented boundary, per the task
 * brief): implementation.md section 10.8 lists the FULL public export file
 * set (`audit-summary.json`, `portals.json`, `findings.json`, a flattened
 * `assam-audit.csv`, `methodology.json`) as part of the polished public
 * download experience — that full set, its exact file names, and any
 * download-page UX belong to Session 16. This session's `export --format
 * json|csv` produces a single, genuinely correct, schema-valid, safely
 * escaped flattened dataset from the PUBLISHED (reviewed) run — one JSON
 * array of `PublishedPortalAssessment` plus the run summary, or one CSV
 * with arrays flattened to counts/canonical URLs per §10.8's own
 * guidance — proving the export pipeline is correct end-to-end without
 * building Session 16's full multi-file public download page.
 */
export function buildJsonExport(
  assessments: PublishedPortalAssessment[],
  summary: PublicationSummary,
): string {
  return `${JSON.stringify({ summary, portals: assessments }, null, 2)}\n`;
}

const CSV_HEADERS = [
  "portalId",
  "name",
  "canonicalUrl",
  "department",
  "portalType",
  "officialStatus",
  "technicalHealth",
  "continuingRole",
  "suggestedAction",
  "criticalFindingCount",
  "significantFindingCount",
  "advisoryFindingCount",
  "reviewedFindingCount",
  "pagesAttempted",
  "pagesObserved",
  "linksChecked",
  "browserFallbackUsed",
  "coverageNote",
  "lastCheckedAt",
  "auditRunId",
];

export function buildCsvExport(assessments: PublishedPortalAssessment[]): string {
  const rows = [...assessments]
    .sort((a, b) => a.portal.id.localeCompare(b.portal.id))
    .map((a) => [
      a.portal.id,
      a.portal.name,
      a.portal.canonicalUrl,
      a.portal.department ?? "",
      a.portal.portalType,
      a.portal.officialStatus,
      a.technicalHealth,
      a.continuingRole,
      a.suggestedAction,
      a.criticalFindingCount,
      a.significantFindingCount,
      a.advisoryFindingCount,
      a.reviewedFindings.length,
      a.crawlCoverage.pagesAttempted,
      a.crawlCoverage.pagesObserved,
      a.crawlCoverage.linksChecked,
      a.crawlCoverage.browserFallbackUsed,
      a.crawlCoverage.coverageNote,
      a.lastCheckedAt,
      a.auditRunId,
    ]);
  return buildCsv(CSV_HEADERS, rows);
}
