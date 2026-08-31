import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { EXPERIENCE_STATUS_VALUES, FREE_TEXT_MAX_LENGTH } from "../constants.js";
import { experienceSubmissions } from "./submissions.js";

/**
 * `experience_moderation` — the decision record, kept in a separate table
 * from `experience_submissions` (implementation.md section 9.5's own table
 * list, and section 5.14's "must be stored separately"). One-to-one with a
 * submission (`submission_id` is `unique`, and a moderation row is created
 * at the same time as its submission with `status: "pending"`, inside the
 * same transaction — see `src/repository/submissions.ts`), not a
 * decision-history table: `moderatedAt` is singular in the
 * `ExperienceSubmission` Zod shape this table round-trips into, and a
 * re-decision is expected to be rare and correctable (a moderator fixing
 * their own mistake), not something that needs an audit trail this
 * session. A history table is a documented, deferred extension if a later
 * session needs one.
 *
 * `onDelete: "cascade"` lets the retention job delete a rejected
 * `experience_submissions` row directly and have its moderation row follow
 * automatically, rather than needing two coordinated deletes.
 */
export const experienceModeration = pgTable(
  "experience_moderation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .unique()
      .references(() => experienceSubmissions.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true, mode: "date" }),
    moderationReasonCode: text("moderation_reason_code"),
    /** Moderator-redacted text shown publicly. Never the original
     * `freeText`. For an `approved` decision made without an explicit
     * `--public-text`, the moderation CLI defaults this to the original
     * `freeText` verbatim (documented in src/repository/moderation.ts). */
    publicText: varchar("public_text", { length: FREE_TEXT_MAX_LENGTH }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("experience_moderation_status_idx").on(table.status),
    // Partial index supporting "moderation queue ordering": the queue
    // query filters on status = 'pending' and joins to
    // experience_submissions.created_at for FIFO ordering (see
    // experience_submissions_created_at_idx); this partial index keeps
    // that filter cheap as the table grows.
    index("experience_moderation_pending_idx")
      .on(table.submissionId)
      .where(sql`${table.status} = 'pending'`),
    check(
      "experience_moderation_status_check",
      sql`${table.status} IN ${sql.raw(`(${EXPERIENCE_STATUS_VALUES.map((value) => `'${value}'`).join(", ")})`)}`,
    ),
  ],
);

export type ExperienceModerationRow = typeof experienceModeration.$inferSelect;
export type NewExperienceModerationRow = typeof experienceModeration.$inferInsert;
