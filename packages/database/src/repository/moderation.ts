import { asc, eq } from "drizzle-orm";
import { InvalidModerationDecisionError, SubmissionNotFoundError } from "../errors.js";
import { experienceModeration } from "../schema/moderation.js";
import { experienceSubmissions } from "../schema/submissions.js";
import type { Db } from "../client.js";

/** One row a human moderator sees in `pnpm experiences:queue`. Deliberately
 * does not include the full, unbounded `freeText` — see
 * `truncateForModerationPreview` and its doc comment. */
export interface ModerationQueueItem {
  submissionId: string;
  portalId: string;
  createdAt: string;
  taskType: string;
  outcome: string;
  themes: string[];
  freeTextPreview: string | null;
  consentToPublish: boolean;
}

const FREE_TEXT_PREVIEW_MAX_CHARS = 160;

/**
 * Truncates free text for the moderation queue listing. This is the
 * intentional moderation UI showing a human moderator the content they
 * need in order to decide — a fundamentally different thing from
 * accidental logging of free text into telemetry/error output (section
 * 9.8's actual prohibition). It is still capped and marked with an
 * ellipsis so `experiences:queue` never dumps an unbounded block of text
 * to a terminal; a moderator who needs the full text uses
 * `experiences:moderate --id <id>` output before deciding, if a future
 * session adds a "show full text" mode — this session keeps the queue
 * view itself bounded.
 */
export function truncateForModerationPreview(freeText: string | null): string | null {
  if (freeText === null) return null;
  if (freeText.length <= FREE_TEXT_PREVIEW_MAX_CHARS) return freeText;
  return `${freeText.slice(0, FREE_TEXT_PREVIEW_MAX_CHARS)}…`;
}

/**
 * Lists pending submissions oldest-first (FIFO), so a submission that has
 * been waiting longest for a decision is always seen first — a documented,
 * simple queue-ordering policy consistent with the
 * `experience_submissions_created_at_idx` / `experience_moderation_pending_idx`
 * indexes.
 */
export async function listModerationQueue(
  db: Db,
  options?: { limit?: number },
): Promise<ModerationQueueItem[]> {
  const rows = await db
    .select({ submission: experienceSubmissions, moderation: experienceModeration })
    .from(experienceModeration)
    .innerJoin(
      experienceSubmissions,
      eq(experienceSubmissions.id, experienceModeration.submissionId),
    )
    .where(eq(experienceModeration.status, "pending"))
    .orderBy(asc(experienceSubmissions.createdAt))
    .limit(options?.limit ?? 50);

  return rows.map(({ submission }) => ({
    submissionId: submission.id,
    portalId: submission.portalId,
    createdAt: submission.createdAt.toISOString(),
    taskType: submission.taskType,
    outcome: submission.outcome,
    themes: submission.themes,
    freeTextPreview: truncateForModerationPreview(submission.freeText),
    consentToPublish: submission.consentToPublish,
  }));
}

export type ModerationDecision = "approved" | "rejected" | "needs_redaction";

export interface RecordModerationDecisionInput {
  submissionId: string;
  decision: ModerationDecision;
  reasonCode?: string;
  /** Redacted text to publish. Required for `needs_redaction`. For
   * `approved` without an explicit value, defaults to the original
   * `freeText` verbatim (documented below) — a moderator only needs to
   * pass `--public-text` for `approved` when they are also redacting
   * something. */
  publicText?: string;
}

/**
 * Records a moderation decision as a single atomic `UPDATE ... WHERE
 * submission_id = ? RETURNING *`. This is what makes concurrent decisions
 * on the same submission safe without an explicit lock: two near-
 * simultaneous calls are two independent UPDATE statements against the
 * same row; Postgres serializes them, and the final state is whichever
 * commits last — one consistent row, never a duplicate or partial one,
 * because this table is one-to-one-by-unique-constraint and nothing here
 * ever inserts a second moderation row for the same submission.
 *
 * `approved` without `publicText`: publishes the original `freeText`
 * verbatim (moderator judged no redaction was necessary). This is the
 * simplest correct default given `ExperienceStatus`'s four values —
 * `needs_redaction` is the status a moderator picks instead when
 * `publicText` must differ from `freeText`, so `approved` is not expected
 * to itself carry an implicit "and redact" meaning.
 */
export async function recordModerationDecision(
  db: Db,
  input: RecordModerationDecisionInput,
): Promise<void> {
  if (input.decision === "needs_redaction" && !input.publicText) {
    throw new InvalidModerationDecisionError(
      "needs_redaction requires --public-text with the redacted text to publish.",
    );
  }

  await db.transaction(async (tx) => {
    let publicText = input.publicText ?? null;
    if (input.decision === "approved" && publicText === null) {
      const [submission] = await tx
        .select({ freeText: experienceSubmissions.freeText })
        .from(experienceSubmissions)
        .where(eq(experienceSubmissions.id, input.submissionId))
        .limit(1);
      if (!submission) {
        throw new SubmissionNotFoundError(input.submissionId);
      }
      publicText = submission.freeText;
    }

    const updated = await tx
      .update(experienceModeration)
      .set({
        status: input.decision,
        moderatedAt: new Date(),
        moderationReasonCode: input.reasonCode ?? null,
        publicText,
        updatedAt: new Date(),
      })
      .where(eq(experienceModeration.submissionId, input.submissionId))
      .returning();

    if (updated.length === 0) {
      throw new SubmissionNotFoundError(input.submissionId);
    }
  });
}

/** Convenience predicate mirroring implementation.md section 5.14's
 * publication gate: "cannot be publicly returned unless consentToPublish
 * is true and status is approved." */
export function isPubliclyVisible(status: string, consentToPublish: boolean): boolean {
  return status === "approved" && consentToPublish;
}
