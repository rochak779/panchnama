/**
 * Technical-health derivation — implementation.md section 7.7.
 *
 * PROVISIONAL vs. FINAL (read before using this function elsewhere):
 * section 7.7's own definitions are phrased in terms of *reviewed*
 * findings ("the portal entry point meets a **reviewed** unavailability
 * rule," "at least one **reviewed** critical/significant technical
 * finding exists," "no **reviewed** critical/significant finding exists").
 * No `ReviewDecision` records exist until Session 8 — this session only
 * produces *candidate* findings (`reviewStatus` values like
 * `"pending_review"`/`"automated_observation"`/`"not_assessable"`, never
 * `"reviewed"`). This function is therefore a PROVISIONAL, PRE-REVIEW
 * computation: it treats "a candidate critical/significant finding is
 * present" as the best available proxy signal for what the reviewed rule
 * would eventually say. It is NOT the final, publishable `TechnicalHealth`
 * shown to end users — that is Session 8 (review) and Session 11
 * (publication UI)'s job, computed from `reviewed`-only findings.
 * `analyze`'s CLI output labels this field `provisionalTechnicalHealth`
 * for exactly this reason — see `packages/audit-cli/src/analyze/`.
 */

import type { Finding, TechnicalHealth } from "@panchnama/schema";
import type { FindingDraft } from "./rules/types.js";

/** Rule IDs whose critical-severity output represents "the entry point
 * itself could not be reached at all" (as opposed to a technical problem
 * on an otherwise-reachable portal). Exported so the session-8 publication
 * transformer (`packages/audit-cli`) can reuse the exact same rule-id sets
 * when deriving the FINAL, reviewed-only `TechnicalHealth` instead of
 * duplicating this list. */
export const UNAVAILABILITY_RULE_IDS = new Set([
  "availability.unavailable.v1",
  "availability.not-found.v1",
  "availability.server-error.v1",
]);

export const NOT_ASSESSABLE_RULE_IDS = new Set([
  "availability.automation-blocked.v1",
  "availability.access-restricted.v1",
]);

export function deriveProvisionalTechnicalHealth(findings: FindingDraft[]): TechnicalHealth {
  const criticalUnavailability = findings.some(
    (f) => f.severity === "critical" && UNAVAILABILITY_RULE_IDS.has(f.ruleId),
  );
  if (criticalUnavailability) {
    return "unavailable";
  }

  const otherCriticalOrSignificant = findings.some(
    (f) =>
      (f.severity === "critical" || f.severity === "significant") &&
      !NOT_ASSESSABLE_RULE_IDS.has(f.ruleId),
  );
  if (otherCriticalOrSignificant) {
    return "degraded";
  }

  const notAssessable = findings.some((f) => NOT_ASSESSABLE_RULE_IDS.has(f.ruleId));
  if (notAssessable) {
    return "not_assessable";
  }

  return "healthy";
}

/**
 * FINAL technical-health derivation (Session 8) — implementation.md
 * section 7.7, computed from `reviewed`-only `Finding` records rather than
 * candidate `FindingDraft`s. This is the value the publication transformer
 * writes into `PublishedPortalAssessment.technicalHealth`.
 *
 * Only findings with `reviewStatus === "reviewed"` are considered — a
 * finding a reviewer rejected or marked `needs_more_evidence` never
 * reaches this function in the first place (the publication transformer
 * filters to `ReviewDecision.decision === "publish"` findings, which are
 * always stamped `reviewStatus: "reviewed"` at that point — see
 * `review/transform.ts`), but the extra guard here keeps this function
 * correct even if called with a mixed set.
 */
export function deriveTechnicalHealthFromReviewedFindings(findings: Finding[]): TechnicalHealth {
  const reviewed = findings.filter((f) => f.reviewStatus === "reviewed");

  const criticalUnavailability = reviewed.some(
    (f) => f.severity === "critical" && UNAVAILABILITY_RULE_IDS.has(f.ruleId),
  );
  if (criticalUnavailability) {
    return "unavailable";
  }

  const otherCriticalOrSignificant = reviewed.some(
    (f) =>
      (f.severity === "critical" || f.severity === "significant") &&
      !NOT_ASSESSABLE_RULE_IDS.has(f.ruleId),
  );
  if (otherCriticalOrSignificant) {
    return "degraded";
  }

  const notAssessable = reviewed.some((f) => NOT_ASSESSABLE_RULE_IDS.has(f.ruleId));
  if (notAssessable) {
    return "not_assessable";
  }

  return "healthy";
}
