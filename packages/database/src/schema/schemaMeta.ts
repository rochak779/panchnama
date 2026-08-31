import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * `experience_schema_meta` — a deliberately thin, single-row table.
 *
 * Drizzle Kit already tracks *which migration files have been applied* in
 * its own internal `drizzle.__drizzle_migrations` journal table — this
 * package does not need to reimplement that. What that journal does NOT
 * record is the *domain* schema version this database currently expects,
 * i.e. `SCHEMA_VERSIONS.experienceSubmission` /
 * `SCHEMA_VERSIONS.portalExperienceSummary` from
 * `@panchnama/schema/src/common.ts` at the time migrations were last run —
 * useful for a future operator or Session 10 to answer "does this
 * database's shape match the Zod schema version the app code expects?"
 * without diffing migration file names.
 *
 * `id` is a fixed literal so there is always exactly one row; `db:migrate`
 * upserts it after running migrations.
 */
export const experienceSchemaMeta = pgTable("experience_schema_meta", {
  id: text("id").primaryKey().default("singleton"),
  experienceSubmissionSchemaVersion: text("experience_submission_schema_version").notNull(),
  portalExperienceSummarySchemaVersion: text("portal_experience_summary_schema_version").notNull(),
  lastMigratedAt: timestamp("last_migrated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
});

export type ExperienceSchemaMetaRow = typeof experienceSchemaMeta.$inferSelect;
export type NewExperienceSchemaMetaRow = typeof experienceSchemaMeta.$inferInsert;
