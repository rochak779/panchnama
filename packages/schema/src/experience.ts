import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId } from "./common.js";
import { experienceStatusSchema, experienceThemeSchema, taskOutcomeSchema } from "./enums.js";

const experienceRatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/**
 * Section 5.12. Top-level stored record — carries `schemaVersion`.
 *
 * Deliberately anonymous: no name, email, phone, government ID,
 * application/reference number, account identifier, attachment, or exact
 * address field exists on this schema (see the spec's prose above the
 * interface). This is enforced by omission (the field simply isn't part of
 * the schema, and `.strict()` rejects any extra field a caller might try to
 * smuggle in) rather than by a runtime PII-detector in this package.
 *
 * §5.14 invariants NOT enforced here, and why: most of ExperienceSubmission's
 * invariants are about *query-time visibility* or *cross-record* behavior,
 * not the shape of a single stored record:
 *   - "cannot be publicly returned unless consentToPublish is true and
 *     status is approved" — a record with consentToPublish: false and
 *     status: "pending" is a perfectly valid *stored* record; the
 *     invariant governs what a read API is allowed to return, not what
 *     `.parse()` should reject. Belongs to the submission API session.
 *   - "must reference an existing published portal ID" — needs the
 *     published portal set. Cross-record, deferred.
 *   - "Rejected and pending submissions never contribute to public
 *     aggregates" — an aggregation-time rule, not a single-record shape
 *     rule; see PortalExperienceSummary below.
 *   - "Original free text and moderator-redacted public text must be
 *     stored separately" — already satisfied structurally: `freeText` and
 *     `publicText` are two distinct optional fields; there is nothing
 *     further to `.refine()`.
 */
export const experienceSubmissionSchema = z
  .object({
    id: stableId,
    schemaVersion: schemaVersionField,
    portalId: stableId,
    createdAt: isoTimestamp,
    occurredOn: z.string().optional(), // month or date; never infer more precision
    taskType: nonEmptyString, // controlled vocabulary plus "other"
    taskDescription: z.string().max(280).optional(),
    outcome: taskOutcomeSchema,
    themes: z.array(experienceThemeSchema),
    deviceType: z.enum(["mobile", "desktop", "tablet", "other"]).optional(),
    experienceRating: experienceRatingSchema.optional(),
    freeText: z.string().max(1000).optional(),
    consentToPublish: z.boolean(),
    status: experienceStatusSchema,
    moderatedAt: isoTimestamp.optional(),
    moderationReasonCode: z.string().optional(),
    publicText: z.string().optional(), // redacted text; never overwrite original
    source: z.enum(["public_form", "research_interview"]),
    privacyFlags: z.array(z.string()),
    duplicateOf: stableId.optional(),
  })
  .strict();

export type ExperienceSubmission = z.infer<typeof experienceSubmissionSchema>;

const outcomeCountsSchema = z
  .object({
    completed: z.number().int().nonnegative(),
    partially_completed: z.number().int().nonnegative(),
    not_completed: z.number().int().nonnegative(),
    information_only: z.number().int().nonnegative(),
  })
  .strict();

const themeCountsSchema = z.record(experienceThemeSchema, z.number().int().nonnegative());

/** Section 5.13. Top-level published record — carries `schemaVersion`. */
export const portalExperienceSummarySchema = z
  .object({
    schemaVersion: schemaVersionField,
    portalId: stableId,
    approvedExperienceCount: z.number().int().nonnegative(),
    outcomeCounts: outcomeCountsSchema,
    themeCounts: themeCountsSchema,
    ratingCount: z.number().int().nonnegative(),
    averageRating: z.number().min(1).max(5).optional(),
    earliestExperienceDate: z.string().optional(),
    latestExperienceDate: z.string().optional(),
    minimumDisplayThresholdApplied: z.boolean(),
    generatedAt: isoTimestamp,
  })
  .strict();

export type PortalExperienceSummary = z.infer<typeof portalExperienceSummarySchema>;
