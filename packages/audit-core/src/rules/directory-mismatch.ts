/**
 * Directory-mismatch rules — implementation.md section 7.5.
 *
 * Implements three of the four detections this session's brief calls out
 * as determinable from data already loaded by `analyze`:
 *   1. A directory entry points to a destination this run found
 *      critically unavailable (cross-referenced against availability
 *      findings already produced earlier in the same pipeline run).
 *   2. Listed name vs. observed destination material disagreement, using a
 *      best-effort token-overlap heuristic on the name and a host-equality
 *      check on the URL (documented heuristic, not a semantic match).
 *   3. A verified official portal that is not backed by any
 *      `official_directory`-typed `InventorySource` — i.e. it is known to
 *      be official but does not appear to be listed in the directory this
 *      inventory build treats as authoritative.
 *
 * "Multiple directory entries appear to represent the same portal"
 * (§7.5's fourth bullet) is NOT implemented this session — it needs
 * cross-portal deduplication logic beyond this session's explicit
 * implement/test list and is recorded as a known limitation in
 * docs/session-log.md.
 */

import type { InventorySource, Portal } from "@panchnama/schema";
import type { AnalysisContext, FindingDraft, PortalRuleInput, Rule } from "./types.js";

function sourcesForPortal(portal: Portal, context: AnalysisContext): InventorySource[] {
  const refs = new Set(portal.sourceRefs);
  return context.inventorySources.filter((s) => refs.has(s.id));
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

export const directoryMismatchUnavailableDestinationRule: Rule = {
  ruleId: "directory_mismatch.unavailable-destination.v1",
  version: 1,
  category: "directory_mismatch",
  description: "A directory entry points to a destination this run found critically unavailable.",
  evaluate: (input: PortalRuleInput, context) => {
    const { portal, priorFindings } = input;
    const directorySources = sourcesForPortal(portal, context).filter(
      (s) => s.sourceType === "official_directory",
    );
    if (directorySources.length === 0) return [];
    const criticalAvailability = priorFindings.filter(
      (f) => f.category === "availability" && f.severity === "critical",
    );
    if (criticalAvailability.length === 0) return [];
    const drafts: FindingDraft[] = [];
    for (const source of directorySources) {
      drafts.push({
        portalId: portal.id,
        ruleId: "directory_mismatch.unavailable-destination.v1",
        category: "directory_mismatch",
        title: "Directory entry points to an unavailable destination",
        summary: `The official directory linked to a destination that returned an availability failure (${criticalAvailability.map((f) => f.ruleId).join(", ")}).`,
        severity: "advisory",
        confidence: "medium",
        checkStatus: "fail",
        reviewStatus: "pending_review",
        firstObservedAt: source.retrievedAt,
        lastObservedAt: context.analyzedAt,
        affectedUrls: [source.url, portal.canonicalUrl],
        suggestionRuleId: "suggestion.directory-mismatch.v1",
        suggestedAction: "manual_assessment",
        limitations: [
          "This cross-references availability findings from this same run; it does not independently re-verify the directory listing's own destination URL byte-for-byte against the portal's canonical URL.",
        ],
        evidence: [
          {
            type: "directory_listing",
            description: `The directory source "${source.name}" (retrieved ${source.retrievedAt}) lists ${source.url}, which this run found critically unavailable.`,
            sourceUrl: source.url,
            content: JSON.stringify({ source, criticalAvailability }),
          },
        ],
      });
    }
    return drafts;
  },
};

export const directoryMismatchListedVsObservedRule: Rule = {
  ruleId: "directory_mismatch.listed-vs-observed.v1",
  version: 1,
  category: "directory_mismatch",
  description:
    "Listed directory name/host materially disagrees with the observed portal name/host, or the directory URL redirects to a different host.",
  evaluate: (input: PortalRuleInput, context) => {
    const { portal, pageObservations } = input;
    const directorySources = sourcesForPortal(portal, context).filter(
      (s) => s.sourceType === "official_directory",
    );
    const drafts: FindingDraft[] = [];
    for (const source of directorySources) {
      const sourceHost = hostOf(source.url);
      const portalHost = hostOf(portal.canonicalUrl);
      const entryObs = pageObservations.find((o) => o.requestedUrl === portal.canonicalUrl);
      const finalHost = entryObs?.finalUrl !== undefined ? hostOf(entryObs.finalUrl) : undefined;

      const hostMismatch =
        sourceHost !== undefined && portalHost !== undefined && sourceHost !== portalHost;
      const redirectsElsewhere =
        finalHost !== undefined && sourceHost !== undefined && finalHost !== sourceHost;

      const sourceTokens = nameTokens(source.name);
      const portalTokens = nameTokens(portal.name);
      const overlap = [...sourceTokens].some((t) => portalTokens.has(t));
      const nameMismatch = sourceTokens.size > 0 && portalTokens.size > 0 && !overlap;

      if (!hostMismatch && !redirectsElsewhere && !nameMismatch) continue;

      const reasons: string[] = [];
      if (nameMismatch)
        reasons.push(
          `the directory's listed name "${source.name}" shares no significant word with the portal's recorded name "${portal.name}"`,
        );
      if (hostMismatch)
        reasons.push(
          `the directory's listed URL host (${sourceHost}) differs from the portal's canonical URL host (${portalHost})`,
        );
      if (redirectsElsewhere)
        reasons.push(
          `the directory's listed URL host (${sourceHost}) differs from where the portal's entry page was ultimately observed (${finalHost})`,
        );

      drafts.push({
        portalId: portal.id,
        ruleId: "directory_mismatch.listed-vs-observed.v1",
        category: "directory_mismatch",
        title: "Directory listing disagrees with observed destination",
        summary: `The official directory listing for this portal disagrees with what was observed: ${reasons.join("; ")}.`,
        severity: "advisory",
        confidence: "low",
        checkStatus: "warning",
        reviewStatus: "pending_review",
        firstObservedAt: source.retrievedAt,
        lastObservedAt: context.analyzedAt,
        affectedUrls: [source.url, portal.canonicalUrl],
        suggestionRuleId: "suggestion.directory-mismatch.v1",
        suggestedAction: "manual_assessment",
        limitations: [
          "Name comparison is a best-effort token-overlap heuristic, not a semantic or authoritative match; a genuine mismatch requires manual confirmation.",
        ],
        evidence: [
          {
            type: "directory_listing",
            description: `Directory source "${source.name}" (${source.url}, retrieved ${source.retrievedAt}) compared against observed portal "${portal.name}" (${portal.canonicalUrl}).`,
            sourceUrl: source.url,
            content: JSON.stringify({
              source,
              portalName: portal.name,
              portalCanonicalUrl: portal.canonicalUrl,
              finalHost,
            }),
          },
        ],
      });
    }
    return drafts;
  },
};

export const directoryMismatchOfficialNotListedRule: Rule = {
  ruleId: "directory_mismatch.official-portal-not-listed.v1",
  version: 1,
  category: "directory_mismatch",
  description:
    "A verified official portal is not backed by any official_directory-typed inventory source.",
  evaluate: (input: PortalRuleInput, context) => {
    const { portal } = input;
    if (portal.officialStatus !== "verified") return [];
    const sources = sourcesForPortal(portal, context);
    const listedInDirectory = sources.some((s) => s.sourceType === "official_directory");
    if (listedInDirectory) return [];
    if (sources.length === 0) return [];
    return [
      {
        portalId: portal.id,
        ruleId: "directory_mismatch.official-portal-not-listed.v1",
        category: "directory_mismatch",
        title: "Verified portal absent from official directory",
        summary: `${portal.name} is a verified official portal but is not backed by any official_directory-typed source in this inventory.`,
        severity: "advisory",
        confidence: "medium",
        checkStatus: "warning",
        reviewStatus: "pending_review",
        firstObservedAt: context.analyzedAt,
        lastObservedAt: context.analyzedAt,
        affectedUrls: [portal.canonicalUrl],
        suggestionRuleId: "suggestion.directory-mismatch.v1",
        suggestedAction: "manual_assessment",
        limitations: [
          "This reflects only the inventory sources attached to this portal record; it does not independently re-crawl every candidate directory to confirm absence.",
        ],
        evidence: [
          {
            type: "directory_listing",
            description: `${portal.name} (${portal.canonicalUrl}) is verified official but its inventory sources (${sources.map((s) => s.sourceType).join(", ")}) do not include an official_directory entry.`,
            sourceUrl: portal.canonicalUrl,
            content: JSON.stringify({ portalId: portal.id, sources }),
          },
        ],
      },
    ];
  },
};

export const DIRECTORY_MISMATCH_RULES: Rule[] = [
  directoryMismatchUnavailableDestinationRule,
  directoryMismatchListedVsObservedRule,
  directoryMismatchOfficialNotListedRule,
];
