/**
 * Rule-engine shared types — implementation.md section 7 / section 14
 * Session 7 ("Create rule registry with IDs and versions").
 *
 * A rule is a pure function: `(portal, context, parameters) =>
 * FindingDraft[]`. It never touches the network or filesystem, and never
 * allocates a stored record `id` itself — id assignment, evidence
 * materialization (writing `EvidenceArtifact` records and resolving
 * `evidenceRefs`), and schema validation happen in `packages/audit-cli`'s
 * `analyze` command, which is the only place with I/O responsibility for
 * this session (mirroring the pure-logic-in-audit-core /
 * orchestration-in-audit-cli split established by every prior package in
 * this repo).
 */

import type {
  Confidence,
  ContinuingRole,
  EvidenceType,
  FindingCategory,
  InventorySource,
  LinkObservation,
  PageObservation,
  Portal,
  ReviewStatus,
  Severity,
  SuggestedAction,
  CheckStatus,
} from "@panchnama/schema";

/**
 * A not-yet-materialized piece of evidence a rule wants attached to a
 * finding it is producing. `content` is a plain-text/JSON-serialized
 * snapshot of the observation(s) that justify the finding (e.g. a
 * redirect chain, a link-check result, an HTTP status summary) — the
 * `analyze` command hashes and stores this content and turns it into a
 * real `EvidenceArtifact` (§5.8) with `privacyReviewed: false` (Session
 * 6's established convention: no automated evidence is privacy-reviewed
 * until a human reviews it in Session 8).
 */
export interface EvidenceDraft {
  type: EvidenceType;
  /** Plain-language, factual caption — not a raw scrape dump (§5.8's own
   * field comment: "editorially reviewed, not raw scrape output"; since
   * this is auto-generated pre-review content, keep it strictly
   * observational and follow §8.4's editorial-language preferences). */
  description: string;
  sourceUrl?: string;
  relatedObservationId?: string;
  /** Serialized snapshot content this evidence artifact stores/hashes. */
  content: string;
}

/** A candidate finding a rule wants to emit, before `id`/`runId`/
 * `evidenceRefs` are assigned by the `analyze` command. */
export interface FindingDraft {
  portalId: string;
  ruleId: string;
  category: FindingCategory;
  title: string;
  summary: string;
  severity: Severity;
  confidence: Confidence;
  checkStatus: CheckStatus;
  reviewStatus: ReviewStatus;
  firstObservedAt: string;
  lastObservedAt: string;
  affectedUrls: string[];
  suggestionRuleId: string;
  suggestedAction: SuggestedAction;
  limitations: string[];
  /** Always non-empty — enforced by `findingSchema`'s own invariant and by
   * the rule-boundary tests in this package. */
  evidence: EvidenceDraft[];
  reviewerRationale?: string;
}

/** Everything a rule may read about one crawl run, scoped so rules that
 * only need one portal's data don't have to filter it out themselves. */
export interface PortalRuleInput {
  portal: Portal;
  pageObservations: PageObservation[];
  linkObservations: LinkObservation[];
  /** Every URL this run chose not to fetch for this portal, and why
   * (scope-excluded, robots-disallowed, budget-cut) — §14 Session 7's
   * "crawl-coverage" category input. */
  skipLog: { url: string; depth: number; reason: string }[];
  /** Candidate findings other (already-run) rules produced for this same
   * portal earlier in the pipeline — lets `directory_mismatch` rules
   * cross-reference availability findings without recomputing them
   * (§7.5's "directory entry points to an unavailable destination"). */
  priorFindings: FindingDraft[];
}

/** Estate-wide context a rule may need beyond its own portal (e.g.
 * directory-mismatch's "verified official portal absent from directory"
 * check, which requires seeing every portal and every inventory source at
 * once). */
export interface AnalysisContext {
  runId: string;
  /** Default timestamp for findings with no more specific observation
   * time to anchor to. */
  analyzedAt: string;
  allPortals: Portal[];
  inventorySources: InventorySource[];
  crawlBoundaries: { maxPagesPerPortal: number; maxDepth: number };
}

export interface Rule {
  ruleId: string;
  /** Numeric version, parsed from the `.vN` suffix of `ruleId` (e.g. `1`
   * for `availability.unavailable.v1`) — kept as a separate field so
   * callers don't have to re-parse the id string. */
  version: number;
  category: FindingCategory;
  description: string;
  evaluate: (
    input: PortalRuleInput,
    context: AnalysisContext,
    /** Rule-specific tunables from `config/checks.yaml`. Optional in this
     * signature because several rules (broken-link, https, freshness,
     * crawl-coverage, directory-mismatch) have no tunable parameters and
     * ignore this argument entirely; rules that DO read parameters (the
     * availability rules) still receive a real object from the registry's
     * `runPortalRules` at call time. */
    parameters?: Record<string, unknown>,
  ) => FindingDraft[];
}

/** `ContinuingRole` is re-exported here only because `technical-health.ts`
 * and `suggestion.ts` reference it in doc comments; the actual derivation
 * of `ContinuingRole` from `possible_overlap` findings is Session 8's job
 * (this session emits no `possible_overlap` findings — see
 * `directory-mismatch.ts` / rule registry doc comments). */
export type { ContinuingRole };
