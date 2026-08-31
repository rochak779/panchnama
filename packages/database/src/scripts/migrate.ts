import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadEnv, requireDatabaseUrl } from "../env.js";
import { createDbClient } from "../client.js";
import { experienceSchemaMeta } from "../schema/schemaMeta.js";

/**
 * `pnpm db:migrate` — applies every committed migration in
 * `packages/database/drizzle/` to the database at `DATABASE_URL`, then
 * upserts the single `experience_schema_meta` row (see that table's doc
 * comment for why this is separate from Drizzle Kit's own migration
 * journal).
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const databaseUrl = requireDatabaseUrl(env);
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = join(here, "..", "..", "drizzle");

  const { db, close } = createDbClient(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
    await db
      .insert(experienceSchemaMeta)
      .values({
        id: "singleton",
        experienceSubmissionSchemaVersion: "1.0.0",
        portalExperienceSummarySchemaVersion: "1.0.0",
        notes: "Updated by pnpm db:migrate.",
      })
      .onConflictDoUpdate({
        target: experienceSchemaMeta.id,
        set: {
          experienceSubmissionSchemaVersion: "1.0.0",
          portalExperienceSummarySchemaVersion: "1.0.0",
          lastMigratedAt: new Date(),
          notes: "Updated by pnpm db:migrate.",
        },
      });
    console.info("Migrations applied successfully.");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("db:migrate failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
