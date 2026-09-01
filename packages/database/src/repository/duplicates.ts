import { and, eq, gte, inArray } from "drizzle-orm";
import { experienceModeration } from "../schema/moderation.js";
import { experienceSubmissions } from "../schema/submissions.js";
import type { Db } from "../client.js";

/**
 * Session 10 addition. A narrow, additive repository function (no schema
 * change) supporting implementation.md section 9.6's duplicate-detection
 * rule: "within a 10-minute window, a new submission matching an existing
 * pending/approved submission on the same abuse key, portalId, taskType,
 * normalized taskDescription, outcome, normalized/sorted themes,
 * month-rounded occurredOn, and normalized freeText is marked
 * `duplicateOf`."
 *
 * This function returns only the cheap, indexable/exact-match half of that
 * comparison (portalId + taskType + outcome + a time window, restricted to
 * submissions still `pending` or `approved` — a `rejected` or
 * `needs_redaction` submission is never a duplicate target). The caller
 * (apps/web's submission route) applies the text-normalization comparison
 * (trimmed/collapsed/lowercased taskDescription and freeText, sorted
 * themes, month-rounded occurredOn) in application code against the
 * returned candidates, because that normalization is this session's
 * responsibility (implementation.md section 9.6 assigns "normalize bounded
 * free text" to the submission API session, not to `packages/database`),
 * and keeping it out of SQL avoids two independently-maintained
 * normalization implementations drifting apart.
 *
 * The "same abuse key" half of the rule is NOT enforced by this function,
 * because `experience_submissions` has no abuse-key column — Session 9's
 * schema was deliberately not restructured for this (see
 * docs/session-log.md Session 10 "Decisions" for the documented
 * approximation the route uses instead: gating on whether the requester's
 * abuse key has any event for this portal in the same 10-minute window,
 * via `countEventsInWindow`).
 */
export interface DuplicateCandidateRow {
  id: string;
  taskDescription: string | null;
  themes: string[];
  occurredOn: string | null;
  freeText: string | null;
  createdAt: Date;
}

export async function findDuplicateCandidates(
  db: Db,
  input: { portalId: string; taskType: string; outcome: string; sinceMinutes: number; now?: Date },
): Promise<DuplicateCandidateRow[]> {
  const since = new Date((input.now ?? new Date()).getTime() - input.sinceMinutes * 60 * 1000);

  const rows = await db
    .select({ submission: experienceSubmissions })
    .from(experienceSubmissions)
    .innerJoin(
      experienceModeration,
      eq(experienceModeration.submissionId, experienceSubmissions.id),
    )
    .where(
      and(
        eq(experienceSubmissions.portalId, input.portalId),
        eq(experienceSubmissions.taskType, input.taskType),
        eq(experienceSubmissions.outcome, input.outcome),
        gte(experienceSubmissions.createdAt, since),
        inArray(experienceModeration.status, ["pending", "approved"]),
      ),
    );

  return rows.map(({ submission }) => ({
    id: submission.id,
    taskDescription: submission.taskDescription,
    themes: submission.themes,
    occurredOn: submission.occurredOn,
    freeText: submission.freeText,
    createdAt: submission.createdAt,
  }));
}
