/**
 * Suggested-action mapping — implementation.md section 7.8.
 *
 * Every rule in `packages/audit-core/src/rules/*` already sets its own
 * `suggestedAction` and `suggestionRuleId` directly at the point it builds
 * a `FindingDraft` (a deliberate structural choice for this session — see
 * `rules/types.ts`'s doc comment: "have each rule set its own severity/
 * confidence directly per the section 7.1 table's explicit per-rule
 * defaults... use your judgment on the cleanest structure"). This module
 * exists as the single, centralized, human-readable record of section
 * 7.8's mapping table, and as the one place regression tests assert the
 * hard constraint from section 7.8's closing line and section 5.14:
 * "Never suggest retirement from downtime alone" / "review_retirement
 * cannot be generated from technical failure alone."
 *
 * `suggestionRuleId` values below are documentation identifiers only (they
 * are not looked up dynamically) — they exist so a generated `Finding`
 * can cite exactly which row of this table produced its
 * `suggestedAction`, per this session's exit criterion ("every candidate
 * finding explains its ... suggestion").
 */

import type { SuggestedAction } from "@panchnama/schema";

export interface SuggestionTemplate {
  suggestionRuleId: string;
  evidence: string;
  suggestedAction: SuggestedAction;
}

export const SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  {
    suggestionRuleId: "suggestion.repeatedly-unavailable.v1",
    evidence: "Repeatedly unavailable official portal",
    suggestedAction: "repair",
  },
  {
    suggestionRuleId: "suggestion.official-link-dead.v1",
    evidence: "Official source links to dead destination",
    suggestedAction: "repair",
  },
  {
    suggestionRuleId: "suggestion.certificate-failure.v1",
    evidence: "Certificate failure",
    suggestedAction: "repair",
  },
  {
    suggestionRuleId: "suggestion.broken-navigation.v1",
    evidence: "Substantial broken navigation",
    suggestedAction: "repair",
  },
  {
    suggestionRuleId: "suggestion.potential-staleness.v1",
    evidence: "Potential staleness",
    suggestedAction: "manual_assessment",
  },
  {
    suggestionRuleId: "suggestion.directory-mismatch.v1",
    evidence: "Directory mismatch",
    // Section 7.8 leaves the repair/manual_assessment split to judgment
    // ("Verify ownership and update the authoritative directory" — this is
    // inherently a verification step before any repair action is
    // justified, since it is not yet known which side, the directory or
    // the portal, is wrong). Documented choice: manual_assessment.
    suggestedAction: "manual_assessment",
  },
  {
    suggestionRuleId: "suggestion.possible-overlap.v1",
    evidence: "Possible overlap",
    // No rule in this session's registry emits a `possible_overlap`
    // finding (section 7.6 requires a completed, human-authored
    // `PortalOverlapComparison` first — Session 8). This row exists so the
    // mapping is already in place for when Session 8's manual workflow
    // produces one.
    suggestedAction: "review_consolidation",
  },
  {
    suggestionRuleId: "suggestion.apparent-obsolete-with-corroboration.v1",
    evidence: "Apparent obsolete portal plus corroborating evidence",
    // This suggestion requires *corroborating* evidence beyond technical
    // downtime alone (e.g. a manual review confirming the mandate has
    // moved elsewhere) — no automated rule in this registry can satisfy
    // that bar by itself, so nothing here ever calls this template from
    // downtime evidence. See `review-retirement-guard.ts` for the
    // regression test enforcing this.
    suggestedAction: "review_retirement",
  },
  {
    suggestionRuleId: "suggestion.manual-verification.v1",
    evidence: "Automation blocked / access restricted — needs manual verification",
    suggestedAction: "manual_assessment",
  },
  {
    suggestionRuleId: "suggestion.no-action.v1",
    evidence: "No issue found (e.g. crawl-coverage summary)",
    suggestedAction: "maintain",
  },
];

/**
 * Rule IDs whose findings are, by category and construction, technical
 * downtime/availability signals ONLY — no corroborating non-technical
 * evidence. Used by the regression guard (and by tests) to assert the
 * hard constraint that no availability-only rule's `suggestedAction` is
 * ever `"review_retirement"`.
 */
export const AVAILABILITY_ONLY_RULE_IDS = [
  "availability.unavailable.v1",
  "availability.server-error.v1",
  "availability.not-found.v1",
  "redirect.cross-domain.v1",
  "availability.automation-blocked.v1",
  "availability.access-restricted.v1",
] as const;
