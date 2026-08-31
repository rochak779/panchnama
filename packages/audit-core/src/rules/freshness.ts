/**
 * Freshness-signal rule — implementation.md section 7.4.
 *
 * Raw-body-availability resolution (documented judgment call, per this
 * session's brief): cautious freshness-signal extraction (explicit
 * last-updated dates, dated notices, copyright years) requires reading
 * text from the actual page body. `PageObservation` (§5.5) deliberately
 * stores only `bodyDigest` (a hash), `title`, `canonical`, and `language`
 * — it does NOT persist raw page text, and this session's `analyze`
 * command reads only `PageObservation`/`LinkObservation`/`EvidenceArtifact`
 * JSON records, not raw crawled HTML bodies (Sessions 4-6 never persisted
 * those to disk). Extending the crawler to additionally persist raw HTML
 * bodies was considered and deliberately NOT done this session: it would
 * touch Session 4/5/6 territory for a capability outside this session's
 * explicit implement list, is a materially larger storage/privacy-review
 * surface (raw HTML may contain more than the curated fields already
 * modeled), and is not required to satisfy this session's stated exit
 * criteria. This is choice (a) from the task brief: skip real
 * content-level extraction this session, and emit only the honest,
 * schema-valid `no_freshness_signal` output for every observed entry
 * page, both `reviewStatus: "pending_review"` and `checkStatus:
 * "not_applicable"` (no assessment was actually performed) — a real,
 * explicitly documented gap for a future session/ADR (see
 * docs/session-log.md), not a silently degraded claim.
 */

import type { PageObservation } from "@panchnama/schema";
import type { Rule } from "./types.js";

function entryObservations(
  portal: { canonicalUrl: string },
  obs: PageObservation[],
): PageObservation[] {
  return obs.filter((o) => o.requestedUrl === portal.canonicalUrl && o.errorCode === undefined);
}

export const freshnessNoSignalRule: Rule = {
  ruleId: "freshness.no-signal.v1",
  version: 1,
  category: "freshness",
  description:
    "Records that no freshness signal could be extracted, because raw page text is not available to this session's analyze command.",
  evaluate: ({ portal, pageObservations }) => {
    const entries = entryObservations(portal, pageObservations);
    if (entries.length === 0) return [];
    const o = entries[0]!;
    return [
      {
        portalId: portal.id,
        ruleId: "freshness.no-signal.v1",
        category: "freshness" as const,
        title: "No freshness signal detected",
        summary: "No recent update signal was detected in the sampled pages.",
        severity: "advisory" as const,
        confidence: "low" as const,
        checkStatus: "not_applicable" as const,
        reviewStatus: "pending_review" as const,
        firstObservedAt: o.checkedAt,
        lastObservedAt: o.checkedAt,
        affectedUrls: [o.requestedUrl],
        suggestionRuleId: "suggestion.potential-staleness.v1",
        suggestedAction: "manual_assessment" as const,
        limitations: [
          "This session's analyze command has access only to structured PageObservation records, not raw crawled page text, so no content-level freshness extraction (last-updated dates, copyright years, dated notices) was performed. A recent date is not proof of correctness, and an old date is not proof of irrelevance, even when this capability is added.",
        ],
        evidence: [
          {
            type: "text_excerpt" as const,
            description: `No freshness signal was extracted for ${o.requestedUrl}; only page metadata (title/canonical/language), not raw body text, was available to this analysis.`,
            sourceUrl: o.requestedUrl,
            relatedObservationId: o.id,
            content: JSON.stringify({
              title: o.title,
              canonical: o.canonical,
              language: o.language,
            }),
          },
        ],
      },
    ];
  },
};

export const FRESHNESS_RULES: Rule[] = [freshnessNoSignalRule];
