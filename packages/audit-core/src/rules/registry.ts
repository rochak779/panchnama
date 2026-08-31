/**
 * Rule registry — implementation.md section 14 Session 7 ("Create rule
 * registry with IDs and versions"). Combines every rule module in this
 * package, and provides the "run only enabled rules from a loaded
 * ChecksConfig" lookup this session's brief asks for. `packages/audit-cli`
 * decides *which* rule ids are enabled (by loading `config/checks.yaml`);
 * this module only needs a plain array shape (`EnabledCheckEntry[]`) so it
 * has no dependency on `audit-cli`'s config-loading types.
 *
 * `possible_overlap` is deliberately absent from every rule below — no
 * rule in this registry emits it. Section 7.6 requires a completed,
 * human-authored `PortalOverlapComparison` (Session 8's manual-review
 * workflow) before a `possible_overlap` finding may exist at all; this
 * session only needs the `Finding` schema's shape to remain satisfiable by
 * that future workflow; it does not auto-generate the finding itself.
 */

import { AVAILABILITY_RULES } from "./availability.js";
import { BROKEN_LINK_RULES } from "./broken-link.js";
import { HTTPS_RULES } from "./https.js";
import { FRESHNESS_RULES } from "./freshness.js";
import { DIRECTORY_MISMATCH_RULES } from "./directory-mismatch.js";
import { CRAWL_COVERAGE_RULES } from "./crawl-coverage.js";
import type { AnalysisContext, FindingDraft, PortalRuleInput, Rule } from "./types.js";

/**
 * Execution order matters only for `directory_mismatch`, whose
 * `unavailable-destination` rule cross-references availability findings
 * already produced earlier in the same portal's pipeline run (via
 * `PortalRuleInput.priorFindings`). Every other category is
 * order-independent. `directory_mismatch` is deliberately listed last.
 */
export const ALL_RULES: Rule[] = [
  ...AVAILABILITY_RULES,
  ...BROKEN_LINK_RULES,
  ...HTTPS_RULES,
  ...FRESHNESS_RULES,
  ...CRAWL_COVERAGE_RULES,
  ...DIRECTORY_MISMATCH_RULES,
];

export function getRuleById(ruleId: string): Rule | undefined {
  return ALL_RULES.find((r) => r.ruleId === ruleId);
}

export interface EnabledCheckEntry {
  ruleId: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
}

export interface SelectedRule {
  rule: Rule;
  parameters: Record<string, unknown>;
}

/** Returns the enabled rules from `checks` that this registry actually
 * implements, paired with their configured parameters. Silently skips any
 * enabled `ruleId` this registry does not implement (documented as a
 * caller-surfaced warning by `analyze`, not a hard crash — a forward- or
 * backward-compatible config file should not break the whole run). */
export function selectEnabledRules(checks: EnabledCheckEntry[]): SelectedRule[] {
  const selected: SelectedRule[] = [];
  for (const check of checks) {
    if (!check.enabled) continue;
    const rule = getRuleById(check.ruleId);
    if (rule === undefined) continue;
    selected.push({ rule, parameters: check.parameters });
  }
  // Re-order by ALL_RULES's canonical order (directory_mismatch last)
  // regardless of the order rules appear in the config file, since
  // directory_mismatch's cross-referencing depends on it.
  return selected.sort((a, b) => ALL_RULES.indexOf(a.rule) - ALL_RULES.indexOf(b.rule));
}

/** Runs every selected rule for one portal, threading each rule's output
 * into `priorFindings` for rules that run after it (only
 * `directory_mismatch` currently reads this). Pure — no I/O. */
export function runPortalRules(
  base: Omit<PortalRuleInput, "priorFindings">,
  context: AnalysisContext,
  selected: SelectedRule[],
): FindingDraft[] {
  const all: FindingDraft[] = [];
  for (const { rule, parameters } of selected) {
    const drafts = rule.evaluate({ ...base, priorFindings: all }, context, parameters);
    all.push(...drafts);
  }
  return all;
}
