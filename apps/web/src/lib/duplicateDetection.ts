import type { DuplicateCandidateRow } from "@panchnama/database";

/**
 * Duplicate-detection normalization and comparison (implementation.md
 * section 9.6): "within a 10-minute window, a new submission matching an
 * existing pending/approved submission on the same abuse key, portalId,
 * taskType, normalized taskDescription, outcome, normalized/sorted themes,
 * month-rounded occurredOn, and normalized freeText is marked
 * `duplicateOf`... Different narratives sharing only the same structured
 * choices are not duplicates."
 *
 * portalId/taskType/outcome are matched by the database query
 * (`findDuplicateCandidates`); this module implements the remaining
 * normalized-text/theme/date comparison in application code, and the
 * "same abuse key" gate (approximated — see `route.ts`'s doc comment,
 * since `experience_submissions` carries no abuse-key column).
 *
 * Normalization here is deliberately looser than `normalizeBoundedText`
 * (lowercased, in addition to whitespace-collapsed) because this is a
 * same-meaning comparison, not a stored/published value — lowercasing
 * `taskDescription`/`freeText` only for this comparison catches
 * "Applied for X" vs "applied for x" as the same narrative without
 * altering what is actually stored.
 */
export function normalizeForComparison(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function sortThemesForComparison(themes: readonly string[]): string {
  return [...themes].sort().join(",");
}

/** Rounds `occurredOn` (a month or full date string) down to its
 * `YYYY-MM` prefix, matching section 9.6's "month-rounded occurredOn". A
 * value shorter than 7 characters (unexpected, but not asserted against by
 * the shared schema) is returned as-is. */
export function monthRoundOccurredOn(occurredOn: string | null | undefined): string {
  if (!occurredOn) return "";
  return occurredOn.length >= 7 ? occurredOn.slice(0, 7) : occurredOn;
}

export interface DuplicateComparisonInput {
  taskDescription: string | null | undefined;
  themes: readonly string[];
  occurredOn: string | null | undefined;
  freeText: string | null | undefined;
}

/** Returns the id of the first candidate whose normalized content exactly
 * matches the incoming submission, or `undefined` if none match. Candidate
 * rows are already scoped to the same portalId/taskType/outcome/time
 * window by the caller's database query. Comparison key uses
 * `JSON.stringify` over the four normalized fields (rather than a plain
 * joined string) so no delimiter ambiguity can cause a false match across
 * field boundaries. */
export function findMatchingCandidateId(
  incoming: DuplicateComparisonInput,
  candidates: readonly DuplicateCandidateRow[],
): string | undefined {
  const incomingKey = buildComparisonKey(incoming);
  for (const candidate of candidates) {
    if (buildComparisonKey(candidate) === incomingKey) {
      return candidate.id;
    }
  }
  return undefined;
}

function buildComparisonKey(input: DuplicateComparisonInput): string {
  return JSON.stringify([
    normalizeForComparison(input.taskDescription),
    sortThemesForComparison(input.themes),
    monthRoundOccurredOn(input.occurredOn),
    normalizeForComparison(input.freeText),
  ]);
}
