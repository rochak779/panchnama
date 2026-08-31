import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId } from "./common.js";
import { severitySchema, suggestedActionSchema } from "./enums.js";

/**
 * Section 5.11. Top-level stored record.
 *
 * Note: unlike the other top-level entities in this package,
 * `ReviewDecision` has no `id` field in the spec — it is keyed by
 * `findingId` (one review decision per finding) and does not itself carry a
 * `schemaVersion` field in the section 5.11 interface. It is nonetheless a
 * top-level stored record per the cross-cutting rule, so `schemaVersion` is
 * added here.
 *
 * "Review overrides must preserve the original automated value" (§5.14) is
 * a cross-record invariant — the "original automated value" lives on the
 * `Finding` this decision reviews, not on the `ReviewDecision` itself, so it
 * cannot be checked from this record alone. Deferred; see TODO below.
 */
export const reviewDecisionSchema = z
  .object({
    schemaVersion: schemaVersionField,
    findingId: stableId,
    decision: z.enum(["publish", "reject", "needs_more_evidence"]),
    reviewedAt: isoTimestamp,
    reviewer: nonEmptyString, // case-study author identifier, not secret PII
    rationale: nonEmptyString,
    overriddenSeverity: severitySchema.optional(),
    overriddenAction: suggestedActionSchema.optional(),
  })
  .strict();

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

// TODO(session-8, publication pipeline): "Review overrides must preserve
// the original automated value" needs the reviewed Finding's original
// severity/suggestedAction to compare against `overriddenSeverity` /
// `overriddenAction`. Cross-record check deferred to the review/publish
// pipeline that holds both records.
