import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId, urlString } from "./common.js";
import {
  checkStatusSchema,
  confidenceSchema,
  reviewStatusSchema,
  severitySchema,
  suggestedActionSchema,
} from "./enums.js";

const findingCategorySchema = z.enum([
  "availability",
  "broken_link",
  "https",
  "freshness",
  "directory_mismatch",
  "possible_overlap",
  "crawl_coverage",
]);
export type FindingCategory = z.infer<typeof findingCategorySchema>;

const findingBaseSchema = z.object({
  id: stableId,
  schemaVersion: schemaVersionField,
  runId: stableId,
  portalId: stableId,
  ruleId: nonEmptyString,
  category: findingCategorySchema,
  title: nonEmptyString,
  summary: nonEmptyString,
  severity: severitySchema,
  confidence: confidenceSchema,
  checkStatus: checkStatusSchema,
  reviewStatus: reviewStatusSchema,
  firstObservedAt: isoTimestamp,
  lastObservedAt: isoTimestamp,
  evidenceRefs: z.array(stableId),
  affectedUrls: z.array(urlString),
  suggestionRuleId: nonEmptyString,
  suggestedAction: suggestedActionSchema,
  overlapComparisonId: stableId.optional(), // required when category === "possible_overlap"
  reviewerRationale: z.string().optional(),
  limitations: z.array(z.string()),
});

/**
 * Section 5.7. Top-level stored record — carries `schemaVersion`.
 *
 * Invariants from §5.14 enforced here (single-record checkable):
 *   - `overlapComparisonId` is required when `category === "possible_overlap"`
 *     (explicitly called out in the spec's own field comment).
 *   - A finding must reference at least one evidence record: `evidenceRefs`
 *     must be non-empty. (Whether those refs actually *resolve* to real,
 *     `privacyReviewed: true` `EvidenceArtifact` records is a cross-record
 *     check — see the TODO below.)
 *   - `checkStatus === "not_assessable"` requires a reason, interpreted here
 *     as a non-empty `limitations` array (this entity has no dedicated
 *     "reason" field, and `limitations` is the closest documented place to
 *     record one).
 */
export const findingSchema = findingBaseSchema.strict().superRefine((finding, ctx) => {
  if (finding.category === "possible_overlap" && finding.overlapComparisonId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["overlapComparisonId"],
      message: 'overlapComparisonId is required when category is "possible_overlap"',
    });
  }

  if (finding.evidenceRefs.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceRefs"],
      message: "a finding must reference at least one evidence record",
    });
  }

  if (finding.checkStatus === "not_assessable" && finding.limitations.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["limitations"],
      message:
        'checkStatus "not_assessable" requires at least one entry in limitations explaining why',
    });
  }
});

export type Finding = z.infer<typeof findingSchema>;

// TODO(session-8, publication pipeline): the following §5.14 invariants
// require records beyond a single Finding and are out of scope here:
//   - Every `evidenceRefs` entry must resolve to an actual `EvidenceArtifact`
//     with `privacyReviewed: true`.
//   - A `possible_overlap` finding's `overlapComparisonId` must resolve to a
//     `PortalOverlapComparison` that: belongs to the same `runId`, has
//     `conclusion === "possible_overlap"`, and has `portalIdA`/`portalIdB`
//     including this finding's `portalId`.
//   - A review decision must be present for interpretive findings (needs the
//     corresponding `ReviewDecision` record, if any).
//   - `review_retirement` cannot be generated from technical failure alone
//     (needs the full evidence/finding set that produced the suggestion).
// These belong to the ingestion/review/publish sessions that hold the full
// record set to validate against.
