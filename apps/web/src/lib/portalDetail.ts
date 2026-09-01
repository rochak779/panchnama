import type {
  EvidenceArtifact,
  Finding,
  PortalOverlapComparison,
  PublishedPortalAssessment,
  Severity,
} from "@panchnama/schema";

/**
 * Session 14 ("Portal evidence pages") — pure, unit-testable logic for
 * what a portal detail page may show, kept separate from the React layer
 * for the same reason as Sessions 12–13's `overviewSummary.ts`/
 * `inventoryFilters.ts`. The two functions here directly encode
 * implementation.md's non-negotiable publication-gate rules:
 *
 *   - "Never publish unreviewed adverse findings" (section 1.6 principle 6,
 *     AGENTS.md) — `publishableFindings` only returns findings whose
 *     `reviewStatus` is `"reviewed"` or the honest `"not_assessable"`
 *     terminal state; `"pending_review"`, `"automated_observation"`, and
 *     `"rejected"` never reach a rendered page.
 *   - "An EvidenceArtifact with `privacyReviewed: false` ... must never be
 *     reachable from a published finding" (evidence.ts's own doc comment)
 *     — `publishedEvidenceForFinding` filters every `evidenceRefs` id
 *     through both existence *and* `privacyReviewed === true`.
 */

const PUBLISHABLE_REVIEW_STATUSES: Finding["reviewStatus"][] = ["reviewed", "not_assessable"];

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, significant: 1, advisory: 2 };

/** The subset of `reviewedFindings` safe to publish, sorted most severe first. Never mutates the input. */
export function publishableFindings(assessment: PublishedPortalAssessment): Finding[] {
  return assessment.reviewedFindings
    .filter((f) => PUBLISHABLE_REVIEW_STATUSES.includes(f.reviewStatus))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Groups already-publishable findings by category, preserving each group's severity order. */
export function groupFindingsByCategory(findings: Finding[]): Map<Finding["category"], Finding[]> {
  const groups = new Map<Finding["category"], Finding[]>();
  for (const finding of findings) {
    const group = groups.get(finding.category);
    if (group) {
      group.push(finding);
    } else {
      groups.set(finding.category, [finding]);
    }
  }
  return groups;
}

/**
 * The evidence artifacts a finding may actually cite, given a lookup map
 * of every known artifact by id. Applies both gates: the ref must resolve
 * to a real artifact, and that artifact must be `privacyReviewed`. Order
 * follows the finding's own `evidenceRefs` order.
 */
export function publishedEvidenceForFinding(
  finding: Finding,
  artifactsById: ReadonlyMap<string, EvidenceArtifact>,
): EvidenceArtifact[] {
  const result: EvidenceArtifact[] = [];
  for (const ref of finding.evidenceRefs) {
    const artifact = artifactsById.get(ref);
    if (artifact && artifact.privacyReviewed) {
      result.push(artifact);
    }
  }
  return result;
}

export function toEvidenceArtifactMap(
  artifacts: EvidenceArtifact[],
): ReadonlyMap<string, EvidenceArtifact> {
  return new Map(artifacts.map((a) => [a.id, a]));
}

export interface OverlapContext {
  comparison: PortalOverlapComparison;
  otherPortalId: string;
}

/**
 * The completed, `possible_overlap`-concluded comparison a finding points
 * at, plus which portal id is the "other" side — or `null` if the finding
 * has no overlap comparison, or it doesn't resolve to a real, completed,
 * `possible_overlap` record (implementation.md section 7.6: "only a
 * completed comparison with the conclusion possible_overlap may support a
 * published possible_overlap finding").
 */
export function overlapContextForFinding(
  finding: Finding,
  comparisons: PortalOverlapComparison[],
  currentPortalId: string,
): OverlapContext | null {
  if (!finding.overlapComparisonId) return null;
  const comparison = comparisons.find(
    (c) =>
      c.id === finding.overlapComparisonId &&
      c.status === "completed" &&
      c.conclusion === "possible_overlap",
  );
  if (!comparison) return null;
  const otherPortalId =
    comparison.portalIdA === currentPortalId ? comparison.portalIdB : comparison.portalIdA;
  return { comparison, otherPortalId };
}
