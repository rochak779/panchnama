import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId, urlString } from "./common.js";
import { evidenceTypeSchema } from "./enums.js";

/**
 * Section 5.8. Top-level stored record — carries `schemaVersion`.
 *
 * The publication-gate rule that "an EvidenceArtifact with
 * `privacyReviewed: false` ... must never be reachable from a published
 * finding" (spec text following this interface) is a cross-record
 * invariant — it constrains which `EvidenceArtifact`s a *Finding* may cite,
 * not anything checkable on an `EvidenceArtifact` in isolation (a
 * not-yet-reviewed artifact is a perfectly valid record on its own, e.g.
 * while sitting in `data/evidence/` pending review). See the TODO in
 * finding.ts.
 */
export const evidenceArtifactSchema = z
  .object({
    id: stableId,
    schemaVersion: schemaVersionField,
    runId: stableId,
    portalId: stableId,
    type: evidenceTypeSchema,
    capturedAt: isoTimestamp,
    sourceUrl: urlString.optional(),
    relatedObservationId: stableId.optional(),
    storagePath: nonEmptyString,
    contentDigest: nonEmptyString,
    mimeType: z.string().optional(),
    description: nonEmptyString,
    privacyReviewed: z.boolean(),
    privacyReviewedAt: isoTimestamp.optional(),
    privacyReviewer: z.string().optional(),
    redactions: z.array(z.string()).optional(),
  })
  .strict();

export type EvidenceArtifact = z.infer<typeof evidenceArtifactSchema>;
