import type { ExperienceSubmission } from "@panchnama/schema";
import type { ExperienceModerationRow } from "../schema/moderation.js";
import type { ExperienceSubmissionRow } from "../schema/submissions.js";

/**
 * Maps one `experience_submissions` row plus its one-to-one
 * `experience_moderation` row into the exact shape
 * `experienceSubmissionSchema` from `@panchnama/schema` expects, so a
 * caller can `.parse()` the result. This is the single place that keeps
 * the two-table split consistent with the Zod schema's flat shape — see
 * `src/repository/mapping.test.ts` for the round-trip test this function
 * exists to make possible.
 *
 * `exactOptionalPropertyTypes` is on for this repo, so optional fields are
 * only added to the object when a value is actually present, never set to
 * `undefined`.
 */
export function toExperienceSubmission(
  submission: ExperienceSubmissionRow,
  moderation: ExperienceModerationRow | null,
): ExperienceSubmission {
  const result: ExperienceSubmission = {
    id: submission.id,
    schemaVersion: submission.schemaVersion,
    portalId: submission.portalId,
    createdAt: submission.createdAt.toISOString(),
    taskType: submission.taskType,
    outcome: submission.outcome as ExperienceSubmission["outcome"],
    themes: submission.themes as ExperienceSubmission["themes"],
    consentToPublish: submission.consentToPublish,
    status: (moderation?.status ?? "pending") as ExperienceSubmission["status"],
    source: submission.source as ExperienceSubmission["source"],
    privacyFlags: submission.privacyFlags,
  };

  if (submission.occurredOn !== null) result.occurredOn = submission.occurredOn;
  if (submission.taskDescription !== null) result.taskDescription = submission.taskDescription;
  if (submission.deviceType !== null) {
    result.deviceType = submission.deviceType as ExperienceSubmission["deviceType"];
  }
  if (submission.experienceRating !== null) {
    result.experienceRating =
      submission.experienceRating as ExperienceSubmission["experienceRating"];
  }
  if (submission.freeText !== null) result.freeText = submission.freeText;
  if (submission.duplicateOf !== null) result.duplicateOf = submission.duplicateOf;
  if (moderation?.moderatedAt) result.moderatedAt = moderation.moderatedAt.toISOString();
  if (moderation?.moderationReasonCode)
    result.moderationReasonCode = moderation.moderationReasonCode;
  if (moderation?.publicText) result.publicText = moderation.publicText;

  return result;
}
