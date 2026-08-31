import { eq } from "drizzle-orm";
import type { ExperienceSubmission } from "@panchnama/schema";
import type { Db } from "../client.js";
import { UnknownPortalIdError } from "../errors.js";
import { experienceModeration } from "../schema/moderation.js";
import { experienceSubmissions } from "../schema/submissions.js";
import { toExperienceSubmission } from "./mapping.js";

/** Fields a caller provides when a citizen submits an experience. Everything
 * else (`id`, `createdAt`, `status`, moderation fields) is server-assigned. */
export type NewSubmissionInput = Pick<
  ExperienceSubmission,
  "portalId" | "taskType" | "outcome" | "themes" | "consentToPublish" | "source" | "privacyFlags"
> &
  Partial<
    Pick<
      ExperienceSubmission,
      | "occurredOn"
      | "taskDescription"
      | "deviceType"
      | "experienceRating"
      | "freeText"
      | "duplicateOf"
    >
  > & {
    /** Set only by `db:seed`; never by real submission traffic. */
    seedKey?: string;
  };

/** Checks whether a portalId belongs to the published inventory. Session 10
 * is expected to supply a real implementation backed by
 * `data/published/<runId>/portals`; `src/fixtures/portals.ts` offers a
 * dev/test implementation backed by fixture ids. */
export type IsKnownPortalId = (portalId: string) => boolean | Promise<boolean>;

/**
 * Creates a new `pending` submission (implementation.md section 5.14: "A
 * submission must reference an existing published portal ID" — enforced
 * here in application code; see the module doc in
 * `src/schema/submissions.ts` for why this is not a hard database FK).
 *
 * Writes the submission row and its initial `experience_moderation` row
 * (`status: "pending"`) inside one transaction, so a submission never
 * exists without a matching moderation row to update later.
 */
export async function createPendingSubmission(
  db: Db,
  input: NewSubmissionInput,
  isKnownPortalId: IsKnownPortalId,
): Promise<ExperienceSubmission> {
  if (!(await isKnownPortalId(input.portalId))) {
    throw new UnknownPortalIdError(input.portalId);
  }

  return db.transaction(async (tx) => {
    const [submissionRow] = await tx
      .insert(experienceSubmissions)
      .values({
        portalId: input.portalId,
        taskType: input.taskType,
        outcome: input.outcome,
        themes: [...input.themes],
        consentToPublish: input.consentToPublish,
        source: input.source,
        privacyFlags: [...input.privacyFlags],
        occurredOn: input.occurredOn ?? null,
        taskDescription: input.taskDescription ?? null,
        deviceType: input.deviceType ?? null,
        experienceRating: input.experienceRating ?? null,
        freeText: input.freeText ?? null,
        duplicateOf: input.duplicateOf ?? null,
        seedKey: input.seedKey ?? null,
      })
      .returning();

    if (!submissionRow) {
      throw new Error("Insert into experience_submissions did not return a row.");
    }

    const [moderationRow] = await tx
      .insert(experienceModeration)
      .values({ submissionId: submissionRow.id, status: "pending" })
      .returning();

    if (!moderationRow) {
      throw new Error("Insert into experience_moderation did not return a row.");
    }

    return toExperienceSubmission(submissionRow, moderationRow);
  });
}

export async function getSubmissionById(db: Db, id: string): Promise<ExperienceSubmission | null> {
  const rows = await db
    .select({ submission: experienceSubmissions, moderation: experienceModeration })
    .from(experienceSubmissions)
    .leftJoin(experienceModeration, eq(experienceModeration.submissionId, experienceSubmissions.id))
    .where(eq(experienceSubmissions.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return toExperienceSubmission(row.submission, row.moderation);
}
