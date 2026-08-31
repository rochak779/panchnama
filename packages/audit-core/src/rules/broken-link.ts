/**
 * Broken-link rule — implementation.md section 7.2.
 *
 * Severity-weighting simplification (documented judgment call): section
 * 7.2 asks for "greater severity to prominent service links and links from
 * official directories." Individual `LinkObservation` records carry no
 * per-link provenance tag distinguishing "this link came from an official
 * directory page" from any other internal link, so per-link directory
 * provenance is not cheaply derivable from data this rule already loads.
 * Instead this rule uses two coarser, defensible signals that ARE directly
 * available:
 *   1. Whether the *linking portal itself* is backed by an
 *      `official_directory` or `official_page` `InventorySource` (via
 *      `Portal.sourceRefs`) — an official page linking to a dead
 *      destination is Critical per §8.1 even when the linking page itself
 *      is healthy.
 *   2. Breadth: how many distinct source pages link to the same broken
 *      destination — broader breakage escalates severity even without
 *      official-source provenance.
 * This is a real simplification versus true per-link directory-source
 * weighting; documented here and in docs/session-log.md as a known
 * limitation.
 */

import type { LinkObservation } from "@panchnama/schema";
import type { AnalysisContext, FindingDraft, PortalRuleInput, Rule } from "./types.js";

const FAILURE_STATUSES = new Set(["fail", "not_assessable"]);

function isOfficiallySourced(input: PortalRuleInput, context: AnalysisContext): boolean {
  const sourceIds = new Set(input.portal.sourceRefs);
  return context.inventorySources.some(
    (s) =>
      sourceIds.has(s.id) &&
      (s.sourceType === "official_directory" || s.sourceType === "official_page"),
  );
}

export const brokenLinkRepeatedFailureRule: Rule = {
  ruleId: "broken_link.repeated-failure.v1",
  version: 1,
  category: "broken_link",
  description: "Groups link destinations that repeatedly fail across one or more source pages.",
  evaluate: (input, context) => {
    const { portal, linkObservations } = input;
    const failing = linkObservations.filter((l) => FAILURE_STATUSES.has(l.status));
    if (failing.length === 0) return [];

    const groups = new Map<string, LinkObservation[]>();
    for (const link of failing) {
      const key = link.normalizedDestinationUrl;
      const existing = groups.get(key);
      if (existing) {
        existing.push(link);
      } else {
        groups.set(key, [link]);
      }
    }

    const official = isOfficiallySourced(input, context);
    const drafts: FindingDraft[] = [];
    for (const [destination, links] of groups) {
      const sourcePages = [...new Set(links.map((l) => l.sourcePageUrl))];
      const retried = links.some((l) => l.attempts > 1);
      const severity = official ? "critical" : sourcePages.length >= 3 ? "significant" : "advisory";
      const confidence = retried ? "high" : "medium";
      const sorted = [...links].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
      drafts.push({
        portalId: portal.id,
        ruleId: "broken_link.repeated-failure.v1",
        category: "broken_link",
        title: "Broken link destination",
        summary: `The destination ${destination} failed from ${sourcePages.length} source page(s) on this portal (${links.map((l) => l.errorCode ?? l.httpStatus ?? l.status).join(", ")}).`,
        severity,
        confidence,
        checkStatus: "fail",
        reviewStatus: "pending_review",
        firstObservedAt: sorted[0]!.checkedAt,
        lastObservedAt: sorted[sorted.length - 1]!.checkedAt,
        affectedUrls: [destination, ...sourcePages],
        suggestionRuleId: official
          ? "suggestion.official-link-dead.v1"
          : "suggestion.broken-navigation.v1",
        suggestedAction: "repair",
        limitations: [
          official
            ? "Severity is elevated because the linking portal is itself backed by an official directory/page inventory source, not because this specific link's individual page was confirmed as an official-directory listing (per-link directory provenance is not tracked)."
            : "Severity reflects the number of distinct source pages linking to this destination, not confirmed official-directory provenance for this specific link.",
        ],
        evidence: [
          {
            type: "link_check_result",
            description: `${destination} failed link checks from ${sourcePages.length} source page(s): ${sourcePages.join(", ")}.`,
            sourceUrl: destination,
            relatedObservationId: links[0]!.id,
            content: JSON.stringify(links),
          },
        ],
      });
    }
    return drafts;
  },
};

export const BROKEN_LINK_RULES: Rule[] = [brokenLinkRepeatedFailureRule];
