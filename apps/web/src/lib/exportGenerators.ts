import type { AuditRun, Finding, PublishedPortalAssessment } from "@panchnama/schema";
import {
  CURRENT_METHODOLOGY_VERSION,
  METHODOLOGY_VERSION_HISTORY,
  type MethodologyVersionEntry,
} from "./methodologyContent";
import { publishableFindings } from "./portalDetail";

/**
 * Session 16, Task 1 — pure, unit-testable logic for the five public
 * export files implementation.md section 10.8 requires
 * (`audit-summary.json`, `portals.json`, `findings.json`,
 * `assam-audit.csv`, `methodology.json`). Kept separate from
 * `apps/web/scripts/build-exports.ts` (the thin file-writing CLI wrapper)
 * for the same reason as `portalDetail.ts`/`inventoryFilters.ts`: this
 * module can be imported directly by Vitest without shelling out to the
 * script, and `apps/web/scripts/build-exports.ts` never reimplements a
 * rule that could drift from what's tested here.
 *
 * `assam-audit.csv` itself is not generated here — the script calls
 * `@panchnama/audit-cli`'s existing `buildCsvExport` directly, so this
 * module has no CSV-specific logic to duplicate or drift.
 *
 * Every array here is sorted by portal id then finding id (matching
 * `buildCsvExport`'s own portal-id sort) so re-running the generator
 * produces byte-identical output aside from `generatedAt`.
 */

export interface AuditSummaryExport {
  auditRunId: string;
  geography: string;
  startedAt: string;
  completedAt?: string | undefined;
  status: string;
  methodologyVersion: string;
  portalCount: number;
  portalsSucceeded: number;
  portalsFailed: number;
  portalsPartial: number;
  limitations: string[];
  generatedAt: string;
}

export function buildAuditSummaryExport(auditRun: AuditRun, generatedAt: string): AuditSummaryExport {
  return {
    auditRunId: auditRun.id,
    geography: auditRun.geography,
    startedAt: auditRun.startedAt,
    completedAt: auditRun.completedAt,
    status: auditRun.status,
    methodologyVersion: auditRun.methodologyVersion,
    portalCount: auditRun.portalCount,
    portalsSucceeded: auditRun.portalsSucceeded,
    portalsFailed: auditRun.portalsFailed,
    portalsPartial: auditRun.portalsPartial,
    limitations: auditRun.limitations,
    generatedAt,
  };
}

export interface PortalExport {
  id: string;
  name: string;
  canonicalUrl: string;
  department?: string | undefined;
  portalType: string;
  officialStatus: string;
  technicalHealth: string;
  continuingRole: string;
  suggestedAction: string;
  criticalFindingCount: number;
  significantFindingCount: number;
  advisoryFindingCount: number;
  lastCheckedAt: string;
}

/** Portal identity/status only — never full findings. Sorted by portal id. */
export function buildPortalsExport(assessments: PublishedPortalAssessment[]): PortalExport[] {
  return [...assessments]
    .sort((a, b) => a.portal.id.localeCompare(b.portal.id))
    .map((assessment) => ({
      id: assessment.portal.id,
      name: assessment.portal.name,
      canonicalUrl: assessment.portal.canonicalUrl,
      department: assessment.portal.department,
      portalType: assessment.portal.portalType,
      officialStatus: assessment.portal.officialStatus,
      technicalHealth: assessment.technicalHealth,
      continuingRole: assessment.continuingRole,
      suggestedAction: assessment.suggestedAction,
      criticalFindingCount: assessment.criticalFindingCount,
      significantFindingCount: assessment.significantFindingCount,
      advisoryFindingCount: assessment.advisoryFindingCount,
      lastCheckedAt: assessment.lastCheckedAt,
    }));
}

export interface FindingExport {
  portalId: string;
  findingId: string;
  severity: string;
  category: string;
  title: string;
  summary: string;
  confidence: string;
  reviewStatus: string;
  firstObservedAt: string;
  lastObservedAt: string;
  affectedUrls: string[];
}

function findingToExport(portalId: string, finding: Finding): FindingExport {
  return {
    portalId,
    findingId: finding.id,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    summary: finding.summary,
    confidence: finding.confidence,
    reviewStatus: finding.reviewStatus,
    firstObservedAt: finding.firstObservedAt,
    lastObservedAt: finding.lastObservedAt,
    affectedUrls: finding.affectedUrls,
  };
}

/**
 * Flattened, publishable-only findings across every portal — reuses
 * `publishableFindings` (the existing rejected/unreviewed exclusion rule)
 * rather than reimplementing it. Sorted by portal id then finding id.
 */
export function buildFindingsExport(assessments: PublishedPortalAssessment[]): FindingExport[] {
  const sortedAssessments = [...assessments].sort((a, b) => a.portal.id.localeCompare(b.portal.id));
  const findings: FindingExport[] = [];
  for (const assessment of sortedAssessments) {
    const portalFindings = [...publishableFindings(assessment)].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    for (const finding of portalFindings) {
      findings.push(findingToExport(assessment.portal.id, finding));
    }
  }
  return findings;
}

export interface MethodologyExport {
  version: string;
  versionHistory: MethodologyVersionEntry[];
  generatedAt: string;
}

export function buildMethodologyExport(generatedAt: string): MethodologyExport {
  return {
    version: CURRENT_METHODOLOGY_VERSION,
    versionHistory: METHODOLOGY_VERSION_HISTORY,
    generatedAt,
  };
}
