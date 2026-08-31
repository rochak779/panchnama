/**
 * Availability and redirect rules — implementation.md section 7.1.
 *
 * "Spaced attempts" interpretation (documented judgment call): section 7.1
 * reads "Entry URL fails across 3 spaced attempts." `PageObservation.attempt`
 * (Session 4) records within-run retry/backoff attempts for a single fetch
 * sequence, not checks spread across separate points in time — true
 * multi-run temporal spacing (using `minSpacingMinutes`) would require this
 * command to load and compare *multiple* crawl runs' output directories,
 * which is out of scope for what this session's stated implement/test list
 * requires. This session uses the number of failed within-run attempts for
 * the entry URL as a documented proxy for "spaced attempts," clearly
 * recorded in every triggered finding's `limitations`. A future
 * `analyze --compare-run <id>` enhancement could add real cross-run
 * temporal spacing without changing this rule's shape.
 *
 * 401/403/CAPTCHA/login-wall handling (section 7.1's explicit instruction
 * "Do not classify 401, 403, CAPTCHA, or login requirement as broken
 * without contextual review"): a raw 401 (`errorCode: "AUTH_REQUIRED"`) or
 * 403 (`errorCode: "HTTP_CLIENT_ERROR"`, `httpStatus: 403`) on the entry
 * page never counts as a failed attempt for `availability.unavailable.v1`,
 * `availability.server-error.v1`, or `availability.not-found.v1`. Instead
 * `availability.access-restricted.v1` surfaces it as a low-confidence,
 * `not_assessable`, pending-review advisory finding — never a critical
 * failure claim.
 *
 * Attempt-counting note: a real single crawl run's frontier fetches each
 * distinct URL once, so in practice there is normally exactly one
 * `PageObservation` per entry URL, whose own `attempt` field already
 * reflects the fetcher's internal retry count (`http-fetcher.ts` retries
 * `DNS_FAILURE`/`CONNECT_TIMEOUT`/`READ_TIMEOUT`/`HTTP_SERVER_ERROR` up to
 * `maxAttemptsAvailabilityCritical`; it does NOT retry 404/410, so a
 * `not-found` observation's `attempt` is always `1` from a single run —
 * a further documented consequence of the single-run limitation above).
 * The threshold checks below therefore compare against
 * `max(matching-observation-count, matching-observation.attempt)` so the
 * rule behaves correctly whether it sees one real observation whose
 * `attempt` field already encodes several retries, or (in tests, or a
 * future cross-run world) several separate observation records.
 */

import type { PageObservation } from "@panchnama/schema";
import type { FindingDraft, Rule } from "./types.js";
import { readIntParam } from "./params.js";

/** Failure-category error codes that represent "could not connect / no
 * usable response at all" — the total-failure bucket `unavailable.v1`
 * looks for. Deliberately excludes `HTTP_SERVER_ERROR` (its own rule,
 * `availability.server-error.v1`, with its own threshold) and excludes
 * `AUTH_REQUIRED`/`AUTOMATION_BLOCKED`/`HTTP_CLIENT_ERROR` (handled by
 * their own rules per the 401/403/CAPTCHA carve-out above). */
const TOTAL_FAILURE_CODES = new Set([
  "DNS_FAILURE",
  "CONNECT_TIMEOUT",
  "READ_TIMEOUT",
  "TOO_MANY_REDIRECTS",
  "INTERNAL_AUDIT_ERROR",
  "SSRF_BLOCKED",
]);

function entryObservations(
  portal: { canonicalUrl: string },
  obs: PageObservation[],
): PageObservation[] {
  return obs.filter((o) => o.requestedUrl === portal.canonicalUrl);
}

function observationSummary(o: PageObservation): string {
  const parts = [`attempt ${o.attempt}`, `checkedAt ${o.checkedAt}`, `fetchMode ${o.fetchMode}`];
  if (o.httpStatus !== undefined) parts.push(`httpStatus ${o.httpStatus}`);
  if (o.errorCode !== undefined) parts.push(`errorCode ${o.errorCode}`);
  if (o.errorMessage !== undefined) parts.push(`errorMessage ${o.errorMessage}`);
  return parts.join(", ");
}

function dateList(obs: PageObservation[]): string {
  return obs.map((o) => o.checkedAt.slice(0, 10)).join(", ");
}

/** See the module doc comment's "Attempt-counting note." */
function effectiveAttemptCount(failures: PageObservation[]): number {
  return Math.max(failures.length, ...failures.map((o) => o.attempt), 0);
}

export const availabilityUnavailableRule: Rule = {
  ruleId: "availability.unavailable.v1",
  version: 1,
  category: "availability",
  description:
    "Entry URL fails across the configured number of attempts with a total-connection-failure error code.",
  evaluate: ({ portal, pageObservations }, _context, parameters = {}) => {
    const spacedAttempts = readIntParam(parameters, "spacedAttempts", 3);
    const entries = entryObservations(portal, pageObservations);
    const failures = entries.filter(
      (o) => o.errorCode !== undefined && TOTAL_FAILURE_CODES.has(o.errorCode),
    );
    const count = effectiveAttemptCount(failures);
    if (count < spacedAttempts) {
      return [];
    }
    const draft: FindingDraft = {
      portalId: portal.id,
      ruleId: "availability.unavailable.v1",
      category: "availability",
      title: "Portal entry point unavailable",
      summary: `Unavailable during ${count} checks on ${dateList(failures)}.`,
      severity: "critical",
      confidence: "high",
      checkStatus: "fail",
      reviewStatus: "pending_review",
      firstObservedAt: failures[0]!.checkedAt,
      lastObservedAt: failures[failures.length - 1]!.checkedAt,
      affectedUrls: [portal.canonicalUrl],
      suggestionRuleId: "suggestion.repeatedly-unavailable.v1",
      suggestedAction: "repair",
      limitations: [
        '"Spaced attempts" here means failed attempts within this single crawl run\'s own fetch retry sequence, not checks spread across separate points in time over days/weeks — true multi-run temporal spacing is a deferred capability (see docs/session-log.md).',
      ],
      evidence: [
        {
          type: "http_response_snapshot",
          description: `The entry page at ${portal.canonicalUrl} failed to load on ${failures.length} attempt(s): ${failures.map(observationSummary).join("; ")}.`,
          sourceUrl: portal.canonicalUrl,
          relatedObservationId: failures[0]!.id,
          content: JSON.stringify(failures),
        },
      ],
    };
    return [draft];
  },
};

export const availabilityServerErrorRule: Rule = {
  ruleId: "availability.server-error.v1",
  version: 1,
  category: "availability",
  description: "Repeated 5xx (server error) response on the entry URL.",
  evaluate: ({ portal, pageObservations }, _context, parameters = {}) => {
    const minRepeatedOccurrences = readIntParam(parameters, "minRepeatedOccurrences", 2);
    const entries = entryObservations(portal, pageObservations);
    const failures = entries.filter((o) => o.errorCode === "HTTP_SERVER_ERROR");
    const count = effectiveAttemptCount(failures);
    if (count < minRepeatedOccurrences) {
      return [];
    }
    // Documented split: a repeat count right at the configured threshold is
    // treated as "significant" (still recoverable, e.g. transient
    // overload); any additional repeat beyond the threshold is treated as
    // "sustained" and escalated to "critical". This is this rule's own
    // judgment call for section 7.1's "Critical or significant" — the spec
    // leaves the exact split unspecified.
    const sustained = count > minRepeatedOccurrences;
    const draft: FindingDraft = {
      portalId: portal.id,
      ruleId: "availability.server-error.v1",
      category: "availability",
      title: sustained
        ? "Sustained server errors on entry point"
        : "Repeated server errors on entry point",
      summary: `The entry page returned a server error (5xx) on ${count} of ${entries.length} check(s) (${dateList(failures)}).`,
      severity: sustained ? "critical" : "significant",
      confidence: "high",
      checkStatus: "fail",
      reviewStatus: "pending_review",
      firstObservedAt: failures[0]!.checkedAt,
      lastObservedAt: failures[failures.length - 1]!.checkedAt,
      affectedUrls: [portal.canonicalUrl],
      suggestionRuleId: "suggestion.repeatedly-unavailable.v1",
      suggestedAction: "repair",
      limitations: [
        "The critical/significant split is based on repeat count observed within this single run (at-threshold vs. beyond-threshold), not confirmed sustained downtime across separate runs.",
      ],
      evidence: [
        {
          type: "http_response_snapshot",
          description: `The entry page at ${portal.canonicalUrl} returned a server error on ${failures.length} attempt(s): ${failures.map(observationSummary).join("; ")}.`,
          sourceUrl: portal.canonicalUrl,
          relatedObservationId: failures[0]!.id,
          content: JSON.stringify(failures),
        },
      ],
    };
    return [draft];
  },
};

export const availabilityNotFoundRule: Rule = {
  ruleId: "availability.not-found.v1",
  version: 1,
  category: "availability",
  description: "Official entry URL repeatedly returns 404/410.",
  evaluate: ({ portal, pageObservations }, _context, parameters = {}) => {
    const minRepeatedOccurrences = readIntParam(parameters, "minRepeatedOccurrences", 2);
    const entries = entryObservations(portal, pageObservations);
    const failures = entries.filter((o) => o.httpStatus === 404 || o.httpStatus === 410);
    const count = effectiveAttemptCount(failures);
    if (count < minRepeatedOccurrences) {
      return [];
    }
    const draft: FindingDraft = {
      portalId: portal.id,
      ruleId: "availability.not-found.v1",
      category: "availability",
      title: "Entry URL not found",
      summary: `The official entry URL returned ${failures[0]!.httpStatus} on ${count} of ${entries.length} check(s) (${dateList(failures)}).`,
      severity: "critical",
      confidence: "high",
      checkStatus: "fail",
      reviewStatus: "pending_review",
      firstObservedAt: failures[0]!.checkedAt,
      lastObservedAt: failures[failures.length - 1]!.checkedAt,
      affectedUrls: [portal.canonicalUrl],
      suggestionRuleId: "suggestion.repeatedly-unavailable.v1",
      suggestedAction: "repair",
      limitations: [
        "The crawler's fetch layer does not retry 404/410 responses, so within a single run this rule can only fire when a portal has more than one distinct URL matching the entry page (an unusual case) or via cross-run comparison, which this session's analyze command does not perform.",
      ],
      evidence: [
        {
          type: "http_response_snapshot",
          description: `The entry page at ${portal.canonicalUrl} returned ${failures[0]!.httpStatus} on ${count} attempt(s).`,
          sourceUrl: portal.canonicalUrl,
          relatedObservationId: failures[0]!.id,
          content: JSON.stringify(failures),
        },
      ],
    };
    return [draft];
  },
};

export const redirectCrossDomainRule: Rule = {
  ruleId: "redirect.cross-domain.v1",
  version: 1,
  category: "availability",
  description: "Final host after redirects is outside the portal's registered hostnames.",
  evaluate: ({ portal, pageObservations }) => {
    const entries = entryObservations(portal, pageObservations);
    const drafts: FindingDraft[] = [];
    for (const o of entries) {
      const finalUrl =
        o.finalUrl ??
        (o.redirectChain.length > 0 ? o.redirectChain[o.redirectChain.length - 1]!.url : undefined);
      if (finalUrl === undefined) continue;
      let finalHost: string;
      try {
        finalHost = new URL(finalUrl).hostname.toLowerCase();
      } catch {
        continue;
      }
      const registeredHosts = new Set(portal.hostnames.map((h) => h.toLowerCase()));
      if (registeredHosts.has(finalHost)) continue;
      drafts.push({
        portalId: portal.id,
        ruleId: "redirect.cross-domain.v1",
        category: "availability",
        title: "Redirect leaves the portal's registered hosts",
        summary: `The entry URL ${o.requestedUrl} finally resolved to ${finalUrl}, outside the portal's registered hostnames.`,
        severity: "advisory",
        confidence: "medium",
        checkStatus: "warning",
        reviewStatus: "pending_review",
        firstObservedAt: o.checkedAt,
        lastObservedAt: o.checkedAt,
        affectedUrls: [o.requestedUrl, finalUrl],
        suggestionRuleId: "suggestion.directory-mismatch.v1",
        suggestedAction: "manual_assessment",
        limitations: [
          "A cross-domain redirect can be a legitimate consolidation or rebrand; this finding requires manual review before any conclusion.",
        ],
        evidence: [
          {
            type: "redirect_chain",
            description: `Requesting ${o.requestedUrl} redirected to ${finalUrl}, a host not listed in this portal's registered hostnames.`,
            sourceUrl: o.requestedUrl,
            relatedObservationId: o.id,
            content: JSON.stringify(o.redirectChain),
          },
        ],
      });
    }
    return drafts;
  },
};

export const availabilityAutomationBlockedRule: Rule = {
  ruleId: "availability.automation-blocked.v1",
  version: 1,
  category: "availability",
  description: "Bot-block or CAPTCHA detected on the entry page — not a confirmed failure.",
  evaluate: ({ portal, pageObservations }) => {
    const entries = entryObservations(portal, pageObservations);
    const blocked = entries.filter((o) => o.errorCode === "AUTOMATION_BLOCKED");
    if (blocked.length === 0) return [];
    const o = blocked[0]!;
    return [
      {
        portalId: portal.id,
        ruleId: "availability.automation-blocked.v1",
        category: "availability",
        title: "Automated check was blocked",
        summary: `The automated crawler was blocked (bot-block or CAPTCHA) while checking ${o.requestedUrl}; this is not evidence the page is broken for a human visitor.`,
        severity: "advisory",
        confidence: "low",
        checkStatus: "not_assessable",
        reviewStatus: "not_assessable",
        firstObservedAt: blocked[0]!.checkedAt,
        lastObservedAt: blocked[blocked.length - 1]!.checkedAt,
        affectedUrls: [o.requestedUrl],
        suggestionRuleId: "suggestion.manual-verification.v1",
        suggestedAction: "manual_assessment",
        limitations: [
          "Automation blocking prevents a fair automated assessment of this page; a human should check it directly before drawing any availability conclusion.",
        ],
        evidence: [
          {
            type: "http_response_snapshot",
            description: `The automated check of ${o.requestedUrl} was blocked (errorCode: ${o.errorCode}${o.errorMessage ? `, ${o.errorMessage}` : ""}).`,
            sourceUrl: o.requestedUrl,
            relatedObservationId: o.id,
            content: JSON.stringify(blocked),
          },
        ],
      },
    ];
  },
};

export const availabilityAccessRestrictedRule: Rule = {
  ruleId: "availability.access-restricted.v1",
  version: 1,
  category: "availability",
  description:
    "Entry page returned 401/403 (authentication or access restriction) — surfaced for manual review, never as a confirmed failure.",
  evaluate: ({ portal, pageObservations }) => {
    const entries = entryObservations(portal, pageObservations);
    const restricted = entries.filter(
      (o) =>
        o.errorCode === "AUTH_REQUIRED" ||
        (o.errorCode === "HTTP_CLIENT_ERROR" && o.httpStatus === 403),
    );
    if (restricted.length === 0) return [];
    const o = restricted[0]!;
    return [
      {
        portalId: portal.id,
        ruleId: "availability.access-restricted.v1",
        category: "availability",
        title: "Entry page requires authentication or restricts access",
        summary: `The entry page returned ${o.httpStatus ?? o.errorCode} while checking ${o.requestedUrl}; this may reflect a legitimate access restriction rather than a broken page.`,
        severity: "advisory",
        confidence: "low",
        checkStatus: "not_assessable",
        reviewStatus: "pending_review",
        firstObservedAt: restricted[0]!.checkedAt,
        lastObservedAt: restricted[restricted.length - 1]!.checkedAt,
        affectedUrls: [o.requestedUrl],
        suggestionRuleId: "suggestion.manual-verification.v1",
        suggestedAction: "manual_assessment",
        limitations: [
          "A 401/403 response is not classified as broken without contextual review (implementation.md section 7.1); manual confirmation of whether this restriction is intentional is required.",
        ],
        evidence: [
          {
            type: "http_response_snapshot",
            description: `${o.requestedUrl} returned ${o.httpStatus ?? o.errorCode}, an access-restriction response, not a confirmed availability failure.`,
            sourceUrl: o.requestedUrl,
            relatedObservationId: o.id,
            content: JSON.stringify(restricted),
          },
        ],
      },
    ];
  },
};

export const AVAILABILITY_RULES: Rule[] = [
  availabilityUnavailableRule,
  availabilityServerErrorRule,
  availabilityNotFoundRule,
  redirectCrossDomainRule,
  availabilityAutomationBlockedRule,
  availabilityAccessRestrictedRule,
];
