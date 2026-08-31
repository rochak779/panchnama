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

import type { TechnicalHealth } from "@panchnama/schema";
import type { FindingDraft } from "./rules/types.js";

/** Rule IDs whose critical-severity output represents "the entry point
 * itself could not be reached at all" (as opposed to a technical problem
 * on an otherwise-reachable portal). */
const UNAVAILABILITY_RULE_IDS = new Set([
  "availability.unavailable.v1",
  "availability.not-found.v1",
  "availability.server-error.v1",
]);

const NOT_ASSESSABLE_RULE_IDS = new Set([
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
