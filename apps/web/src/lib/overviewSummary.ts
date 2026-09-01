import type {
  Finding,
  PublishedPortalAssessment,
  Severity,
  SuggestedAction,
  TechnicalHealth,
} from "@panchnama/schema";

/**
 * Session 12 ("Assam overview") — pure, unit-testable derivations from a
 * validated `PublishedPortalAssessment[]` (never invented client-side
 * numbers). implementation.md section 10.2 asks for "counts by technical
 * health", "counts by severity and suggested action", "top priority
 * findings", and a "directory mismatch summary" — every function here
 * produces exactly one of those, from the same assessment records the
 * overview page already loads, so the numbers on the page can never drift
 * from the per-portal fields they're derived from. None of this composes
 * into a single score (implementation.md section 1.6 principle 2 / section
 * 10.2's explicit "do not include a composite score").
 */

const TECHNICAL_HEALTH_VALUES: TechnicalHealth[] = [
  "healthy",
  "degraded",
  "unavailable",
  "not_assessable",
];

const SEVERITY_VALUES: Severity[] = ["critical", "significant", "advisory"];

const SUGGESTED_ACTION_VALUES: SuggestedAction[] = [
  "maintain",
  "repair",
  "review_consolidation",
  "review_retirement",
  "manual_assessment",
];

/** Counts by `technicalHealth`, always including all four keys (even at 0) so a rendered grid never has to guess whether a missing key means zero or an unknown status. */
export function countByTechnicalHealth(
  assessments: PublishedPortalAssessment[],
): Record<TechnicalHealth, number> {
  const counts = Object.fromEntries(TECHNICAL_HEALTH_VALUES.map((v) => [v, 0])) as Record<
    TechnicalHealth,
    number
  >;
  for (const assessment of assessments) {
    counts[assessment.technicalHealth] += 1;
  }
  return counts;
}

/**
 * Counts by severity, summed from each assessment's own
 * `criticalFindingCount`/`significantFindingCount`/`advisoryFindingCount`
 * fields rather than re-counting `reviewedFindings` — those per-assessment
 * counts are the published record of how many findings of each severity
 * exist, independent of whether every finding's full detail is embedded.
 */
export function countBySeverity(
  assessments: PublishedPortalAssessment[],
): Record<Severity, number> {
  const counts = Object.fromEntries(SEVERITY_VALUES.map((v) => [v, 0])) as Record<Severity, number>;
  for (const assessment of assessments) {
    counts.critical += assessment.criticalFindingCount;
    counts.significant += assessment.significantFindingCount;
    counts.advisory += assessment.advisoryFindingCount;
  }
  return counts;
}

/** Counts by each portal's overall `suggestedAction`. */
export function countBySuggestedAction(
  assessments: PublishedPortalAssessment[],
): Record<SuggestedAction, number> {
  const counts = Object.fromEntries(SUGGESTED_ACTION_VALUES.map((v) => [v, 0])) as Record<
    SuggestedAction,
    number
  >;
  for (const assessment of assessments) {
    counts[assessment.suggestedAction] += 1;
  }
  return counts;
}

export interface PriorityFinding {
  finding: Finding;
  portalId: string;
  portalName: string;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, significant: 1, advisory: 2 };

/**
 * The N highest-severity, most-recently-observed reviewed findings across
 * every assessment, each carrying its portal's name so the list is
 * readable without a second lookup. Only `reviewStatus === "reviewed"`
 * findings are eligible — an automated observation or a pending/rejected
 * finding has not cleared the human review implementation.md section 1.6
 * principle 6 requires before it can be presented as a priority.
 */
export function topPriorityFindings(
  assessments: PublishedPortalAssessment[],
  limit = 5,
): PriorityFinding[] {
  const eligible: PriorityFinding[] = [];
  for (const assessment of assessments) {
    for (const finding of assessment.reviewedFindings) {
      if (finding.reviewStatus !== "reviewed") continue;
      eligible.push({
        finding,
        portalId: assessment.portal.id,
        portalName: assessment.portal.name,
      });
    }
  }
  eligible.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.finding.severity] - SEVERITY_RANK[b.finding.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.finding.lastObservedAt.localeCompare(a.finding.lastObservedAt);
  });
  return eligible.slice(0, limit);
}

/** Every reviewed `directory_mismatch` finding, across all assessments, with portal context — implementation.md section 10.2's separate "directory mismatch summary". */
export function directoryMismatchFindings(
  assessments: PublishedPortalAssessment[],
): PriorityFinding[] {
  const results: PriorityFinding[] = [];
  for (const assessment of assessments) {
    for (const finding of assessment.reviewedFindings) {
      if (finding.category !== "directory_mismatch" || finding.reviewStatus !== "reviewed")
        continue;
      results.push({ finding, portalId: assessment.portal.id, portalName: assessment.portal.name });
    }
  }
  return results;
}

export interface NotAssessablePortal {
  portalId: string;
  portalName: string;
  coverageNote: string;
}

/** Every `not_assessable` portal with its coverage note — the honest reason implementation.md section 7.7 requires alongside that status. */
export function notAssessablePortals(
  assessments: PublishedPortalAssessment[],
): NotAssessablePortal[] {
  return assessments
    .filter((assessment) => assessment.technicalHealth === "not_assessable")
    .map((assessment) => ({
      portalId: assessment.portal.id,
      portalName: assessment.portal.name,
      coverageNote: assessment.crawlCoverage.coverageNote,
    }));
}
