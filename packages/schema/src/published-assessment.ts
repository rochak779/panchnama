import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId } from "./common.js";
import { continuingRoleSchema, suggestedActionSchema, technicalHealthSchema } from "./enums.js";
import { findingSchema } from "./finding.js";
import { portalSchema } from "./portal.js";

const crawlCoverageSchema = z
  .object({
    pagesAttempted: z.number().int().nonnegative(),
    pagesObserved: z.number().int().nonnegative(),
    linksChecked: z.number().int().nonnegative(),
    browserFallbackUsed: z.boolean(),
    coverageNote: nonEmptyString,
  })
  .strict();

const publishedPortalAssessmentBaseSchema = z.object({
  schemaVersion: schemaVersionField,
  portal: portalSchema,
  auditRunId: stableId,
  technicalHealth: technicalHealthSchema,
  continuingRole: continuingRoleSchema,
  suggestedAction: suggestedActionSchema,
  criticalFindingCount: z.number().int().nonnegative(),
  significantFindingCount: z.number().int().nonnegative(),
  advisoryFindingCount: z.number().int().nonnegative(),
  crawlCoverage: crawlCoverageSchema,
  reviewedFindings: z.array(findingSchema),
  lastCheckedAt: isoTimestamp,
});

/**
 * Section 5.10. Top-level published record — carries `schemaVersion` (not
 * shown in the spec's interface, added per the cross-cutting rule; see
 * common.ts).
 *
 * Invariants from §5.14 enforced here (single-record checkable, made
 * possible because `reviewedFindings` is embedded directly in this record):
 *   - `technicalHealth === "healthy"` requires that no finding in
 *     `reviewedFindings` is both `reviewStatus === "reviewed"` and
 *     `severity` in `{critical, significant}` ("healthy means no enabled
 *     check produced a reviewed critical or significant finding").
 *   - `technicalHealth === "not_assessable"` requires a reason, interpreted
 *     here as a non-trivial (non-empty after trimming) `crawlCoverage.
 *     coverageNote`, since this entity has no separate "reason" field.
 */
export const publishedPortalAssessmentSchema = publishedPortalAssessmentBaseSchema
  .strict()
  .superRefine((assessment, ctx) => {
    if (assessment.technicalHealth === "healthy") {
      const disqualifying = assessment.reviewedFindings.some(
        (f) =>
          f.reviewStatus === "reviewed" &&
          (f.severity === "critical" || f.severity === "significant"),
      );
      if (disqualifying) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["technicalHealth"],
          message:
            'technicalHealth "healthy" requires no reviewed critical or significant finding in reviewedFindings',
        });
      }
    }

    if (
      assessment.technicalHealth === "not_assessable" &&
      assessment.crawlCoverage.coverageNote.trim().length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["crawlCoverage", "coverageNote"],
        message:
          'technicalHealth "not_assessable" requires a non-empty coverageNote explaining why',
      });
    }
  });

export type PublishedPortalAssessment = z.infer<typeof publishedPortalAssessmentSchema>;

// TODO(session-8, publication pipeline): "Every exported result must
// include audit date, methodology version, and limitations" needs the
// referenced AuditRun (methodologyVersion, limitations) alongside this
// record — `auditRunId` only points at it. Cross-record check deferred.
