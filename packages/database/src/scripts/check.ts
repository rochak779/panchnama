import { loadEnv, requireDatabaseUrl } from "../env.js";
import { createDbClient } from "../client.js";
import { experienceSchemaMeta } from "../schema/schemaMeta.js";

/**
 * `pnpm db:check` — a reachability + migration-freshness health check, not
 * Drizzle Kit's own `drizzle-kit check` (which validates a migration
 * *history* for conflicts between snapshots, an authoring-time concern
 * this session's single initial migration doesn't yet need). What
 * operators actually want from a command named `db:check` in this
 * project's workflow is: "can I reach the configured database, and is it
 * migrated?" — so this is a small custom script rather than a passthrough
 * to `drizzle-kit check`.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const databaseUrl = requireDatabaseUrl(env);
  const { db, client, close } = createDbClient(databaseUrl);
  try {
    await client`select 1`;
    console.info("Database is reachable.");

    const rows = await db.select().from(experienceSchemaMeta).limit(1);
    const meta = rows[0];
    if (!meta) {
      console.error(
        "experience_schema_meta has no row — migrations have not been applied yet. Run `pnpm db:migrate`.",
      );
      process.exitCode = 1;
      return;
    }
    console.info(
      `Schema metadata: experienceSubmission v${meta.experienceSubmissionSchemaVersion}, ` +
        `portalExperienceSummary v${meta.portalExperienceSummarySchemaVersion}, ` +
        `last migrated at ${meta.lastMigratedAt.toISOString()}.`,
    );

    const tableCheck = await client<{ exists: boolean }[]>`
      select exists (
        select 1 from information_schema.tables
        where table_name = 'experience_submissions'
      ) as exists
    `;
    if (!tableCheck[0]?.exists) {
      console.error("experience_submissions table is missing. Run `pnpm db:migrate`.");
      process.exitCode = 1;
      return;
    }
    console.info("db:check PASSED");
  } catch (error) {
    console.error("db:check FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("db:check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
