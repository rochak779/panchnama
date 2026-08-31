import { SCHEMA_VERSIONS } from "@panchnama/schema";
import type {
  Finding,
  Portal,
  PortalOverlapComparison,
  PublishedPortalAssessment,
  ReviewDecision,
  SuggestedAction,
} from "@panchnama/schema";
import { deriveTechnicalHealthFromReviewedFindings } from "@panchnama/audit-core";
import { loadPortalCrawlCoverage } from "./crawl-coverage-load.js";
import type { ReviewValidationResult } from "./validate.js";

/**
 * Publication transformer — implementation.md section 14 Session 8,
 * "Publication transformer producing portal assessments and summary
 * counts."
 *
 * OVERRIDE-APPLICATION INTERPRETATION (documented judgment call, per this
 * session's task brief): `review.ts`'s TODO says "review overrides must
 * preserve the original automated value." The permanent record of both the
 * original AND the override is the pairing of (a) the untouched original
 * `Finding` in `data/raw/analysis/<runId>/findings.jsonl` (this transformer
 * never writes there) and (b) the `ReviewDecision` file in
 * `data/review/decisions/<findingId>.json`, which always carries its own
 * `overriddenSeverity`/`overriddenAction` alongside the fact that it is
 * reviewing a specific finding — nothing about the original is lost from
 * the permanent record. The PUBLISHED finding, by contrast, is the
 * reviewer's FINAL call: since `PublishedPortalAssessment.reviewedFindings`
 * embeds full `Finding` records and §5.14's `healthy` gate reads
 * `severity`/`reviewStatus` directly off those embedded records, the
 * override is baked into the embedded finding's own `severity`/
 * `suggestedAction` fields (there is no secondary "effective severity"
 * field for health derivation or the UI to consult) — a bare `severity`
 * field on a published Finding, without the override applied, would be
 * actively misleading to a reader who does not also cross-reference
 * `data/review/`. `reviewStatus` is set to `"reviewed"` on every embedded
 * finding, per `ReviewStatus`'s enum and §7.7's health-derivation text.
 */
export function applyReviewOverride(finding: Finding, decision: ReviewDecision): Finding {
  return {
    ...finding,
    reviewStatus: "reviewed",
    severity: decision.overriddenSeverity ?? finding.severity,
    suggestedAction: decision.overriddenAction ?? finding.suggestedAction,
  };
}

const SUGGESTED_ACTION_PRIORITY: SuggestedAction[] = [
  "review_retirement",
  "repair",
  "review_consolidation",
  "manual_assessment",
  "maintain",
];

function mostUrgentSuggestedAction(actions: SuggestedAction[]): SuggestedAction {
  if (actions.length === 0) {
    return "maintain";
  }
  let best = actions[0]!;
  let bestRank = SUGGESTED_ACTION_PRIORITY.indexOf(best);
  for (const action of actions.slice(1)) {
    const rank = SUGGESTED_ACTION_PRIORITY.indexOf(action);
    if (rank !== -1 && (bestRank === -1 || rank < bestRank)) {
      best = action;
      bestRank = rank;
    }
  }
  return best;
}

function selectOverlapComparisonForPortal(
  portalId: string,
  runId: string,
  portalsById: Map<string, Portal>,
  overlapComparisonsById: Map<string, PortalOverlapComparison>,
  effectivePrivacyReviewedArtifactIds: Set<string>,
  evidenceById: Map<string, { id: string; privacyReviewed: boolean }>,
): PortalOverlapComparison | undefined {
  const candidates = Array.from(overlapComparisonsById.values())
    .filter((c) => c.runId === runId)
    .filter((c) => c.portalIdA === portalId || c.portalIdB === portalId)
    .filter((c) => portalsById.has(c.portalIdA) && portalsById.has(c.portalIdB))
    .filter((c) =>
      c.evidenceRefs.every((ref) => {
        const artifact = evidenceById.get(ref);
        return (
          artifact !== undefined &&
          (artifact.privacyReviewed || effectivePrivacyReviewedArtifactIds.has(ref))
        );
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return candidates[0];
}

export interface PublicationSummary {
  schemaVersion: string;
  runId: string;
  publishedAt: string;
  auditDate: string;
  methodologyVersion: string;
  limitations: string[];
  portalCount: number;
  technicalHealthCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  suggestedActionCounts: Record<string, number>;
}

export function transformToPublication(
  validation: ReviewValidationResult,
  params: { crawlOutDir: string; publishedAt: string },
): { assessments: PublishedPortalAssessment[]; summary: PublicationSummary } {
  const { bundle } = validation;
  const portalsById = new Map(bundle.portals.map((p) => [p.id, p]));
  const evidenceById = new Map(bundle.evidenceArtifacts.map((e) => [e.id, e]));

  // Deterministic ordering throughout: sort portals by id, and findings
  // within a portal by finding id — never by object-key iteration order or
  // Map/Set iteration order, both of which are insertion-order-dependent
  // but not necessarily meaningfully deterministic across re-derivations
  // from a JSONL file (line order IS the file's own deterministic order,
  // but we sort explicitly anyway so this holds even if upstream ordering
  // ever changes).
  const publishablePortalIds = new Set(
    bundle.findings
      .filter((f) => validation.publishableFindingIds.has(f.id))
      .map((f) => f.portalId),
  );
  // Every portal that was part of this run gets an assessment, even with
  // zero published findings (a clean bill of health is still a result).
  const allPortalIdsThisRun = new Set(bundle.findings.map((f) => f.portalId));
  for (const id of publishablePortalIds) {
    allPortalIdsThisRun.add(id);
  }
  const portalIds = Array.from(allPortalIdsThisRun)
    .filter((id) => portalsById.has(id))
    .sort((a, b) => a.localeCompare(b));

  const assessments: PublishedPortalAssessment[] = portalIds.map((portalId) => {
    const portal = portalsById.get(portalId)!;
    const publishedFindings = bundle.findings
      .filter((f) => f.portalId === portalId && validation.publishableFindingIds.has(f.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((f) => applyReviewOverride(f, validation.decisionsByFindingId.get(f.id)!));

    const criticalFindingCount = publishedFindings.filter((f) => f.severity === "critical").length;
    const significantFindingCount = publishedFindings.filter(
      (f) => f.severity === "significant",
    ).length;
    const advisoryFindingCount = publishedFindings.filter((f) => f.severity === "advisory").length;

    const technicalHealth = deriveTechnicalHealthFromReviewedFindings(publishedFindings);
    const crawlCoverage = loadPortalCrawlCoverage({
      crawlOutDir: params.crawlOutDir,
      crawlRunId: bundle.analysisManifest.crawlRunId,
      portalId,
    });

    const comparison = selectOverlapComparisonForPortal(
      portalId,
      bundle.runId,
      portalsById,
      validation.overlapComparisonsById,
      validation.effectivePrivacyReviewedArtifactIds,
      evidenceById,
    );
    const continuingRole =
      comparison === undefined
        ? "not_reviewed"
        : comparison.conclusion === "possible_overlap"
          ? "possible_overlap"
          : comparison.conclusion === "distinct"
            ? "distinct"
            : "unclear";

    const suggestedAction = mostUrgentSuggestedAction(
      publishedFindings.map((f) => f.suggestedAction),
    );

    const lastCheckedAt =
      publishedFindings.length > 0
        ? publishedFindings
            .map((f) => f.lastObservedAt)
            .sort()
            .at(-1)!
        : bundle.analysisManifest.analyzedAt;

    const assessment: PublishedPortalAssessment = {
      schemaVersion: SCHEMA_VERSIONS.publishedPortalAssessment,
      portal,
      auditRunId: bundle.runId,
      technicalHealth,
      continuingRole,
      suggestedAction,
      criticalFindingCount,
      significantFindingCount,
      advisoryFindingCount,
      crawlCoverage,
      reviewedFindings: publishedFindings,
      lastCheckedAt,
    };
    return assessment;
  });

  const technicalHealthCounts: Record<string, number> = {};
  const severityCounts: Record<string, number> = { critical: 0, significant: 0, advisory: 0 };
  const suggestedActionCounts: Record<string, number> = {};
  for (const a of assessments) {
    technicalHealthCounts[a.technicalHealth] = (technicalHealthCounts[a.technicalHealth] ?? 0) + 1;
    suggestedActionCounts[a.suggestedAction] = (suggestedActionCounts[a.suggestedAction] ?? 0) + 1;
    severityCounts.critical! += a.criticalFindingCount;
    severityCounts.significant! += a.significantFindingCount;
    severityCounts.advisory! += a.advisoryFindingCount;
  }

  const summary: PublicationSummary = {
    schemaVersion: "1.0.0",
    runId: bundle.runId,
    publishedAt: params.publishedAt,
    auditDate: bundle.auditRun.completedAt ?? bundle.auditRun.startedAt,
    methodologyVersion: bundle.auditRun.methodologyVersion,
    limitations: [...bundle.auditRun.limitations, ...bundle.analysisManifest.limitations],
    portalCount: assessments.length,
    technicalHealthCounts,
    severityCounts,
    suggestedActionCounts,
  };

  return { assessments, summary };
}
