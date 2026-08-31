import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId } from "./common.js";

const overlapBaseSchema = z.object({
  id: stableId,
  schemaVersion: schemaVersionField,
  runId: stableId,
  portalIdA: stableId,
  portalIdB: stableId,
  status: z.literal("completed"),
  reviewedAt: isoTimestamp,
  reviewer: nonEmptyString,
  intendedUserA: nonEmptyString,
  intendedUserB: nonEmptyString,
  serviceOrTaskA: nonEmptyString,
  serviceOrTaskB: nonEmptyString,
  jurisdictionA: z.string().optional(),
  jurisdictionB: z.string().optional(),
  transactionStageA: z.string().optional(),
  transactionStageB: z.string().optional(),
  responsibleAuthorityA: z.string().optional(),
  responsibleAuthorityB: z.string().optional(),
  linksOrRedirectsBetween: z.boolean(),
  materialSimilarities: z.array(z.string()),
  materialDifferences: z.array(z.string()),
  // `duplicate` / `redundant` are deliberately not valid values — see the
  // spec note under §5.9: this enum is the mechanism that forbids those
  // forbidden §7.6 conclusions from ever being emitted, even by mistake.
  conclusion: z.enum(["possible_overlap", "distinct", "insufficient_evidence"]),
  uncertaintyNote: nonEmptyString,
  evidenceRefs: z.array(stableId),
});

/**
 * Section 5.9. Top-level stored record — carries `schemaVersion`.
 *
 * Invariants from §5.14 enforced here (single-record checkable):
 *   - `portalIdA !== portalIdB` ("must compare two different ... portals";
 *     whether both portals actually *exist* is a cross-record check — see
 *     the TODO below).
 *   - `evidenceRefs` must be non-empty ("must reference at least one
 *     evidence record"). As with Finding, whether those refs resolve to
 *     real `privacyReviewed: true` `EvidenceArtifact` records is
 *     cross-record and deferred.
 */
export const portalOverlapComparisonSchema = overlapBaseSchema.strict().superRefine((cmp, ctx) => {
  if (cmp.portalIdA === cmp.portalIdB) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["portalIdB"],
      message: "portalIdA and portalIdB must refer to two different portals",
    });
  }

  if (cmp.evidenceRefs.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceRefs"],
      message: "a completed overlap comparison must reference at least one evidence record",
    });
  }
});

export type PortalOverlapComparison = z.infer<typeof portalOverlapComparisonSchema>;

// TODO(session-8, publication pipeline): "must compare two ... existing
// portals" (both portalIdA and portalIdB resolve to real Portal records)
// and "every referenced EvidenceArtifact must have privacyReviewed: true"
// both need records beyond a single PortalOverlapComparison and belong to
// the publish-time cross-record validation pass.
