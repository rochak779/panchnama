import { and, eq, lt } from "drizzle-orm";
import { DEFAULT_RETENTION_REJECTED_DAYS } from "../constants.js";
import { experienceModeration } from "../schema/moderation.js";
import { experienceSubmissions } from "../schema/submissions.js";
import { deleteExpiredAbuseKeys } from "./abuseKeys.js";
import type { Db } from "../client.js";

export interface RetentionReport {
  rejectedSubmissionsDeleted: number;
  expiredAbuseKeysDeleted: number;
}

/**
 * Applies implementation.md section 9.8's documented retention policy:
 * "delete rejected original submissions after 90 days and expired abuse
 * keys within 24 hours, while retaining approved public records until
 * withdrawn or superseded." Approved and pending submissions are never
 * touched by this function — only submissions whose moderation `status`
 * is `rejected` AND whose `moderatedAt` is older than the threshold.
 *
 * Deleting the `experience_submissions` row cascades to its
 * `experience_moderation` row via that table's `onDelete: "cascade"` FK.
 */
export async function runRetention(
  db: Db,
  options?: { rejectedRetentionDays?: number; now?: Date },
): Promise<RetentionReport> {
  const now = options?.now ?? new Date();
  const rejectedRetentionDays = options?.rejectedRetentionDays ?? DEFAULT_RETENTION_REJECTED_DAYS;
  const cutoff = new Date(now.getTime() - rejectedRetentionDays * 24 * 60 * 60 * 1000);

  const rejectedIds = await db
    .select({ submissionId: experienceModeration.submissionId })
    .from(experienceModeration)
    .where(
      and(
        eq(experienceModeration.status, "rejected"),
        lt(experienceModeration.moderatedAt, cutoff),
      ),
    );

  let rejectedSubmissionsDeleted = 0;
  for (const { submissionId } of rejectedIds) {
    const deleted = await db
      .delete(experienceSubmissions)
      .where(eq(experienceSubmissions.id, submissionId))
      .returning({ id: experienceSubmissions.id });
    rejectedSubmissionsDeleted += deleted.length;
  }

  const expiredAbuseKeysDeleted = await deleteExpiredAbuseKeys(db, now);

  return { rejectedSubmissionsDeleted, expiredAbuseKeysDeleted };
}
