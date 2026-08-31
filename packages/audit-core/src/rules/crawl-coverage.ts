/**
 * Crawl-coverage rule — implementation.md section 14 Session 7
 * ("crawl-coverage" category).
 *
 * Representation choice (documented judgment call): rather than folding
 * coverage limitations silently into every other finding's `limitations`
 * array, this emits one low-severity/advisory `crawl_coverage` finding per
 * portal summarizing what was and wasn't covered — pages attempted vs. the
 * configured `maxPagesPerPortal`, whether `maxDepth` was reached, and how
 * many URLs were skipped (scope-excluded, robots-disallowed, or
 * budget-cut) with their reasons. This directly maps onto the kind of
 * summary `PublishedPortalAssessment.crawlCoverage` (§5.10) will need —
 * though wiring this rule's output into that record is Session 8's job,
 * not this session's.
 */

import type { Rule } from "./types.js";

export const crawlCoverageSummaryRule: Rule = {
  ruleId: "crawl_coverage.summary.v1",
  version: 1,
  category: "crawl_coverage",
  description: "Summarizes what this run did and did not cover for a portal.",
  evaluate: ({ portal, pageObservations, skipLog }, context) => {
    if (pageObservations.length === 0 && skipLog.length === 0) return [];
    const pagesObserved = new Set(pageObservations.map((o) => o.requestedUrl)).size;
    const maxDepthReached = skipLog.some((s) => /max ?depth/i.test(s.reason));
    const budgetCut = skipLog.some((s) => /max ?pages|budget/i.test(s.reason));
    const robotsDisallowed = skipLog.filter((s) => /robots/i.test(s.reason)).length;
    const hitPageCap = pagesObserved >= context.crawlBoundaries.maxPagesPerPortal;

    const notes: string[] = [
      `${pagesObserved} page(s) observed (configured maximum: ${context.crawlBoundaries.maxPagesPerPortal}).`,
    ];
    if (hitPageCap || budgetCut)
      notes.push("The per-portal page budget was reached; deeper coverage was not attempted.");
    if (maxDepthReached)
      notes.push(
        `The configured maximum crawl depth (${context.crawlBoundaries.maxDepth}) was reached.`,
      );
    if (robotsDisallowed > 0)
      notes.push(`${robotsDisallowed} URL(s) were not fetched because robots.txt disallowed them.`);
    if (skipLog.length > 0)
      notes.push(
        `${skipLog.length} URL(s) in total were not fetched this run (see evidence for reasons).`,
      );

    const hasLimitation = hitPageCap || budgetCut || maxDepthReached || robotsDisallowed > 0;
    const lastObservedAt =
      pageObservations.length > 0
        ? pageObservations
            .map((o) => o.checkedAt)
            .sort()
            .at(-1)!
        : context.analyzedAt;
    const firstObservedAt =
      pageObservations.length > 0
        ? pageObservations.map((o) => o.checkedAt).sort()[0]!
        : context.analyzedAt;

    return [
      {
        portalId: portal.id,
        ruleId: "crawl_coverage.summary.v1",
        category: "crawl_coverage" as const,
        title: "Crawl coverage summary",
        summary: notes.join(" "),
        severity: "advisory" as const,
        confidence: "high" as const,
        checkStatus: hasLimitation ? ("warning" as const) : ("not_applicable" as const),
        reviewStatus: "automated_observation" as const,
        firstObservedAt,
        lastObservedAt,
        affectedUrls: [portal.canonicalUrl],
        suggestionRuleId: "suggestion.no-action.v1",
        suggestedAction: "maintain" as const,
        limitations: [
          "Coverage is bounded by this run's configured maxPagesPerPortal/maxDepth and robots.txt; an unobserved page cannot be assessed and is not counted as passing.",
        ],
        evidence: [
          {
            type: "text_excerpt" as const,
            description: `Coverage summary for ${portal.id}: ${notes.join(" ")}`,
            sourceUrl: portal.canonicalUrl,
            content: JSON.stringify({ pagesObserved, skipLog }),
          },
        ],
      },
    ];
  },
};

export const CRAWL_COVERAGE_RULES: Rule[] = [crawlCoverageSummaryRule];
