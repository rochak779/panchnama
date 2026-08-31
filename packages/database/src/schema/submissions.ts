import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  DEVICE_TYPE_VALUES,
  EXPERIENCE_THEME_VALUES,
  FREE_TEXT_MAX_LENGTH,
  SUBMISSION_SOURCE_VALUES,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_OUTCOME_VALUES,
} from "../constants.js";

/**
 * `experience_submissions` — the immutable original record (implementation.md
 * section 9.5). Everything the citizen actually typed/chose lives here and
 * is never overwritten by moderation. `freeText` is the original free text;
 * the moderator-redacted `publicText` lives in `experience_moderation`,
 * satisfying section 5.14's "original free text and moderator-redacted
 * public text must be stored separately".
 *
 * `portal_id` is a plain `text` column, not a foreign key to a `portals`
 * table. Sessions 0-8 produce published portals as static JSON under
 * `data/published/<runId>/portals`, not a database table; building a live
 * sync daemon from that static JSON into Postgres just to get a hard FK is
 * disproportionate for this session (implementation.md section 9.5's own
 * phrasing allows "equivalent application validation"). Instead,
 * `createPendingSubmission` (src/repository/submissions.ts) takes an
 * explicit `isKnownPortalId` check and rejects unknown portal ids in
 * application code before any row is written. See docs/session-log.md for
 * the full tradeoff writeup.
 */
export const experienceSubmissions = pgTable(
  "experience_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull().default("1.0.0"),
    portalId: text("portal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    occurredOn: text("occurred_on"),
    taskType: text("task_type").notNull(),
    taskDescription: varchar("task_description", { length: TASK_DESCRIPTION_MAX_LENGTH }),
    outcome: text("outcome").notNull(),
    themes: text("themes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    deviceType: text("device_type"),
    experienceRating: smallint("experience_rating"),
    freeText: varchar("free_text", { length: FREE_TEXT_MAX_LENGTH }),
    consentToPublish: boolean("consent_to_publish").notNull(),
    source: text("source").notNull(),
    privacyFlags: text("privacy_flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    duplicateOf: uuid("duplicate_of"),
    /** Non-null only on rows written by `pnpm db:seed`; lets the seed
     * script find and replace exactly its own rows idempotently without a
     * separate tracking table. Never set outside of seeding. */
    seedKey: text("seed_key").unique(),
  },
  (table) => [
    index("experience_submissions_portal_id_idx").on(table.portalId),
    index("experience_submissions_created_at_idx").on(table.createdAt),
    check(
      "experience_submissions_outcome_check",
      sql`${table.outcome} IN ${sqlList(TASK_OUTCOME_VALUES)}`,
    ),
    check(
      "experience_submissions_device_type_check",
      sql`${table.deviceType} IS NULL OR ${table.deviceType} IN ${sqlList(DEVICE_TYPE_VALUES)}`,
    ),
    check(
      "experience_submissions_source_check",
      sql`${table.source} IN ${sqlList(SUBMISSION_SOURCE_VALUES)}`,
    ),
    check(
      "experience_submissions_rating_check",
      sql`${table.experienceRating} IS NULL OR ${table.experienceRating} BETWEEN 1 AND 5`,
    ),
    check(
      "experience_submissions_themes_check",
      sql`${table.themes} <@ ${sqlArray(EXPERIENCE_THEME_VALUES)}`,
    ),
  ],
);

/** Renders a readonly string tuple as a Postgres `(a, b, c)` literal list
 * for use inside a `sql` template in an `IN (...)` check constraint. */
function sqlList(values: readonly string[]) {
  return sql.raw(`(${values.map((value) => `'${value}'`).join(", ")})`);
}

/** Renders a readonly string tuple as a Postgres `ARRAY[...]::text[]`
 * literal for use in a `<@` (is-contained-by) array check constraint. */
function sqlArray(values: readonly string[]) {
  return sql.raw(`ARRAY[${values.map((value) => `'${value}'`).join(", ")}]::text[]`);
}

export type ExperienceSubmissionRow = typeof experienceSubmissions.$inferSelect;
export type NewExperienceSubmissionRow = typeof experienceSubmissions.$inferInsert;
