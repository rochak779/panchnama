import { z } from "zod";
import { isoTimestamp, schemaVersionField, stableId, urlString } from "./common.js";
import { checkStatusSchema } from "./enums.js";

const redirectChainEntrySchema = z
  .object({
    url: urlString,
    status: z.number().int().optional(),
  })
  .strict();

/** Section 5.5. Top-level stored record — carries `schemaVersion`. */
export const pageObservationSchema = z
  .object({
    id: stableId,
    schemaVersion: schemaVersionField,
    runId: stableId,
    portalId: stableId,
    requestedUrl: urlString,
    finalUrl: urlString.optional(),
    discoveredFrom: urlString.optional(),
    checkedAt: isoTimestamp,
    attempt: z.number().int().positive(),
    fetchMode: z.enum(["http", "browser"]),
    httpStatus: z.number().int().optional(),
    redirectChain: z.array(redirectChainEntrySchema),
    contentType: z.string().optional(),
    durationMs: z.number().nonnegative().optional(),
    title: z.string().optional(),
    canonical: z.string().optional(),
    language: z.string().optional(),
    bodyDigest: z.string().optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    robotsDecision: z.enum(["allowed", "disallowed", "not_checked"]),
    artifactRefs: z.array(stableId),
  })
  .strict();

export type PageObservation = z.infer<typeof pageObservationSchema>;

const linkObservationBaseSchema = z.object({
  id: stableId,
  schemaVersion: schemaVersionField,
  runId: stableId,
  portalId: stableId,
  sourcePageUrl: urlString,
  destinationUrl: urlString,
  normalizedDestinationUrl: urlString,
  anchorText: z.string().optional(),
  relationship: z.enum(["internal", "external"]),
  context: z.string().optional(),
  checkedAt: isoTimestamp,
  status: checkStatusSchema,
  httpStatus: z.number().int().optional(),
  errorCode: z.string().optional(),
  attempts: z.number().int().nonnegative(),
});

/**
 * Section 5.6. Top-level stored record — carries `schemaVersion`.
 *
 * Invariant enforced here (single-record checkable): when `status` is
 * `"not_assessable"`, at least one of `errorCode` / `errorMessage`* must
 * explain why. (*`LinkObservation` has no `errorMessage` field in the spec,
 * only `errorCode`; this reduces to requiring `errorCode` in that case.)
 * This is this package's interpretation of §5.14's "`not_assessable` must
 * include a reason" applied to the one entity in this file where
 * `not_assessable` is a possible `status` value.
 */
export const linkObservationSchema = linkObservationBaseSchema.strict().superRefine((obs, ctx) => {
  if (obs.status === "not_assessable" && obs.errorCode === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["errorCode"],
      message: 'status "not_assessable" requires errorCode to record the reason',
    });
  }
});

export type LinkObservation = z.infer<typeof linkObservationSchema>;
