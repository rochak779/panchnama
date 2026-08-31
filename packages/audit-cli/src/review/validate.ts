import type {
  EvidenceArtifact,
  Finding,
  Portal,
  PortalOverlapComparison,
  ReviewDecision,
} from "@panchnama/schema";
import { AVAILABILITY_ONLY_RULE_IDS } from "@panchnama/audit-core";
import { loadAllDecisions } from "./decision-store.js";
import { loadAllEvidencePrivacyReviews } from "./evidence-privacy-store.js";
import { loadAllOverlapComparisons } from "./overlap-store.js";
import type { ReviewPaths } from "./paths.js";
import { loadRunBundle, type LoadedRunBundle } from "./load-run.js";

export interface ReviewIssue {
  code: string;
  message: string;
  findingId?: string;
}

export interface ReviewValidationResult {
  ok: boolean;
  bundle: LoadedRunBundle;
  issues: ReviewIssue[];
  /** Findings with no ReviewDecision file yet — the "awaiting review" queue
   * (implementation.md section 14 Session 8's "CLI output listing findings
   * awaiting review"). */
  awaitingReview: Finding[];
  decisionsByFindingId: Map<string, ReviewDecision>;
  effectivePrivacyReviewedArtifactIds: Set<string>;
  overlapComparisonsById: Map<string, PortalOverlapComparison>;
  /** Finding ids that passed every publication-gate check AND whose
   * decision is "publish" — the exact set the publication transformer may
   * emit. */
  publishableFindingIds: Set<string>;
}

/**
 * Policy: EVERY candidate finding proposed for publication needs a
 * `ReviewDecision`, not only ones the code can identify as "interpretive".
 * Documented judgment call (Session 8 task brief, point 2): the doc's own
 * §8.3 item 6 ("a review decision is present for interpretive findings")
 * could be read to allow some automated findings to bypass review
 * entirely, but this is a case-study prototype whose credibility rests on
 * visible human review (§1.6 principle 1, "Evidence before judgment").
 * Every candidate `Finding` — regardless of `reviewStatus` — must have a
 * corresponding `ReviewDecision` before its portal's assessment can be
 * published. There is no automated fast-path to publication.
 */
export function isEvidenceEffectivelyPrivacyReviewed(
  artifact: EvidenceArtifact,
  privacyReviewedArtifactIds: Set<string>,
): boolean {
  return artifact.privacyReviewed === true || privacyReviewedArtifactIds.has(artifact.id);
}

export function reviewValidate(params: {
  runId: string;
  analysisOutDir: string;
  crawlOutDir: string;
  inventoryOutDir: string;
  reviewPaths: ReviewPaths;
}): { ok: true; result: ReviewValidationResult } | { ok: false; lines: string[] } {
  const loaded = loadRunBundle({
    runId: params.runId,
    analysisOutDir: params.analysisOutDir,
    crawlOutDir: params.crawlOutDir,
    inventoryOutDir: params.inventoryOutDir,
  });
  if (!loaded.ok) {
    return { ok: false, lines: loaded.lines };
  }
  const bundle = loaded.bundle;
  const issues: ReviewIssue[] = [];

  const findingsById = new Map(bundle.findings.map((f) => [f.id, f]));
  const evidenceById = new Map(bundle.evidenceArtifacts.map((e) => [e.id, e]));
  const portalsById = new Map(bundle.portals.map((p) => [p.id, p]));

  // --- Load and schema-validate every review overlay file ---
  const loadedDecisions = loadAllDecisions(params.reviewPaths.decisionsDir);
  const decisionsByFindingId = new Map<string, ReviewDecision>();
  for (const d of loadedDecisions) {
    if (d.parseError !== undefined) {
      issues.push({
        code: "invalid_review_decision_file",
        message: `${d.file}: ${d.parseError}`,
        findingId: d.findingId,
      });
      continue;
    }
    decisionsByFindingId.set(d.decision!.findingId, d.decision!);
  }

  const loadedPrivacyReviews = loadAllEvidencePrivacyReviews(params.reviewPaths.evidencePrivacyDir);
  const effectivePrivacyReviewedArtifactIds = new Set<string>();
  for (const p of loadedPrivacyReviews) {
    if (p.parseError !== undefined) {
      issues.push({ code: "invalid_evidence_privacy_file", message: `${p.file}: ${p.parseError}` });
      continue;
    }
    if (p.review!.privacyReviewed) {
      effectivePrivacyReviewedArtifactIds.add(p.review!.artifactId);
    }
  }

  const loadedOverlaps = loadAllOverlapComparisons(params.reviewPaths.overlapComparisonsDir);
  const overlapComparisonsById = new Map<string, PortalOverlapComparison>();
  for (const o of loadedOverlaps) {
    if (o.parseError !== undefined) {
      issues.push({
        code: "invalid_overlap_comparison_file",
        message: `${o.file}: ${o.parseError}`,
      });
      continue;
    }
    overlapComparisonsById.set(o.comparison!.id, o.comparison!);
  }

  // --- Stale review references: ReviewDecision.findingId not in this run ---
  for (const decision of decisionsByFindingId.values()) {
    if (!findingsById.has(decision.findingId)) {
      issues.push({
        code: "stale_review_reference",
        message: `ReviewDecision for findingId "${decision.findingId}" does not resolve to any finding in run "${params.runId}" (stale reference — was this decision authored against a different run, or is the finding id mistyped?)`,
        findingId: decision.findingId,
      });
    }
  }

  // --- Every finding proposed for publication needs a decision ---
  const awaitingReview: Finding[] = [];
  for (const finding of bundle.findings) {
    if (!decisionsByFindingId.has(finding.id)) {
      awaitingReview.push(finding);
      issues.push({
        code: "missing_review_decision",
        message: `Finding "${finding.id}" (${finding.ruleId}, ${finding.severity}) has no ReviewDecision yet — every candidate finding must be reviewed before it can be published.`,
        findingId: finding.id,
      });
    }
  }

  // --- Per-finding publication-gate checks, for decision === "publish" ---
  const publishableFindingIds = new Set<string>();
  for (const finding of bundle.findings) {
    const decision = decisionsByFindingId.get(finding.id);
    if (decision === undefined || decision.decision !== "publish") {
      continue;
    }

    let findingOk = true;
    const fail = (code: string, message: string): void => {
      findingOk = false;
      issues.push({ code, message, findingId: finding.id });
    };

    if (!portalsById.has(finding.portalId)) {
      fail(
        "unknown_portal",
        `Finding "${finding.id}" references portalId "${finding.portalId}" which does not exist in the loaded inventory.`,
      );
    }

    // review_retirement cannot be applied via override to an
    // availability-only rule's finding (schema only stops automated
    // rules; this stops a reviewer's override too).
    if (
      decision.overriddenAction === "review_retirement" &&
      (AVAILABILITY_ONLY_RULE_IDS as readonly string[]).includes(finding.ruleId)
    ) {
      fail(
        "review_retirement_from_availability_only",
        `ReviewDecision for finding "${finding.id}" overrides suggestedAction to "review_retirement", but ruleId "${finding.ruleId}" is availability-only technical evidence — review_retirement cannot be generated from technical failure alone (implementation.md §5.14/§7.8), even via a reviewer override.`,
      );
    }

    // Evidence resolution + privacy-review gate.
    for (const ref of finding.evidenceRefs) {
      const artifact = evidenceById.get(ref);
      if (artifact === undefined) {
        fail(
          "unresolved_evidence_ref",
          `Finding "${finding.id}" cites evidenceRef "${ref}" which does not resolve to any EvidenceArtifact in run "${params.runId}".`,
        );
        continue;
      }
      if (!isEvidenceEffectivelyPrivacyReviewed(artifact, effectivePrivacyReviewedArtifactIds)) {
        fail(
          "unreviewed_evidence",
          `Finding "${finding.id}" cites evidenceRef "${ref}" which has not been privacy-reviewed (no privacyReviewed:true overlay at data/review/evidence-privacy/${ref}.json, and the raw artifact's own privacyReviewed is false).`,
        );
      }
    }

    // possible_overlap: the completed comparison must satisfy every
    // §5.9/§5.14/§7.6 relationship, run, portal, evidence, and conclusion
    // invariant.
    if (finding.category === "possible_overlap") {
      const comparisonId = finding.overlapComparisonId;
      const comparison =
        comparisonId !== undefined ? overlapComparisonsById.get(comparisonId) : undefined;
      if (comparisonId === undefined) {
        fail(
          "missing_overlap_comparison_id",
          `Finding "${finding.id}" has category "possible_overlap" but no overlapComparisonId (schema should have already rejected this).`,
        );
      } else if (comparison === undefined) {
        fail(
          "overlap_comparison_not_found",
          `Finding "${finding.id}" references overlapComparisonId "${comparisonId}" which does not resolve to any comparison in data/review/overlap-comparisons/.`,
        );
      } else {
        checkOverlapComparisonForPublication(finding, comparison, {
          runId: params.runId,
          portalsById,
          evidenceById,
          effectivePrivacyReviewedArtifactIds,
          fail,
        });
      }
    }

    if (findingOk) {
      publishableFindingIds.add(finding.id);
    }
  }

  return {
    ok: true,
    result: {
      ok: issues.length === 0,
      bundle,
      issues,
      awaitingReview,
      decisionsByFindingId,
      effectivePrivacyReviewedArtifactIds,
      overlapComparisonsById,
      publishableFindingIds,
    },
  };
}

function checkOverlapComparisonForPublication(
  finding: Finding,
  comparison: PortalOverlapComparison,
  ctx: {
    runId: string;
    portalsById: Map<string, Portal>;
    evidenceById: Map<string, EvidenceArtifact>;
    effectivePrivacyReviewedArtifactIds: Set<string>;
    fail: (code: string, message: string) => void;
  },
): void {
  if (comparison.runId !== ctx.runId) {
    ctx.fail(
      "cross_run_overlap_comparison",
      `Finding "${finding.id}"'s overlap comparison "${comparison.id}" belongs to run "${comparison.runId}", not "${ctx.runId}" — a possible_overlap finding's comparison must be from the same run.`,
    );
  }

  if (comparison.conclusion !== "possible_overlap") {
    ctx.fail(
      "non_publishable_overlap_conclusion",
      `Finding "${finding.id}"'s overlap comparison "${comparison.id}" has conclusion "${comparison.conclusion}" — only a completed comparison whose conclusion is "possible_overlap" can back a published possible_overlap finding.`,
    );
  }

  if (finding.portalId !== comparison.portalIdA && finding.portalId !== comparison.portalIdB) {
    ctx.fail(
      "overlap_portal_mismatch",
      `Finding "${finding.id}"'s portalId "${finding.portalId}" is neither portalIdA ("${comparison.portalIdA}") nor portalIdB ("${comparison.portalIdB}") of comparison "${comparison.id}".`,
    );
  }

  if (!ctx.portalsById.has(comparison.portalIdA)) {
    ctx.fail(
      "overlap_portal_not_found",
      `Overlap comparison "${comparison.id}"'s portalIdA "${comparison.portalIdA}" does not resolve to a real Portal record.`,
    );
  }
  if (!ctx.portalsById.has(comparison.portalIdB)) {
    ctx.fail(
      "overlap_portal_not_found",
      `Overlap comparison "${comparison.id}"'s portalIdB "${comparison.portalIdB}" does not resolve to a real Portal record.`,
    );
  }

  for (const ref of comparison.evidenceRefs) {
    const artifact = ctx.evidenceById.get(ref);
    if (artifact === undefined) {
      ctx.fail(
        "unresolved_overlap_evidence_ref",
        `Overlap comparison "${comparison.id}" cites evidenceRef "${ref}" which does not resolve to any EvidenceArtifact in this run.`,
      );
      continue;
    }
    if (!isEvidenceEffectivelyPrivacyReviewed(artifact, ctx.effectivePrivacyReviewedArtifactIds)) {
      ctx.fail(
        "unreviewed_overlap_evidence",
        `Overlap comparison "${comparison.id}" cites evidenceRef "${ref}" which has not been privacy-reviewed.`,
      );
    }
  }
}
