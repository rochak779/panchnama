import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getTestDbAvailability, getTestDb, closeTestDb } from "../testSupport/testDb.js";

const dbAvailable = await getTestDbAvailability();

afterAll(async () => {
  await closeTestDb();
});

/** Proves migrations apply cleanly to a genuinely empty database: this
 * test drops every table this package owns (plus Drizzle Kit's own
 * migration journal) and re-runs `migrate()` from scratch. */
describe.skipIf(!dbAvailable)("migrations", () => {
  it("apply cleanly to an empty database and create every expected table", async () => {
    const { db, client } = getTestDb();

    await db.execute(sql`DROP TABLE IF EXISTS experience_moderation CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS experience_submissions CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS experience_abuse_keys CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS experience_schema_meta CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

    const here = dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = join(here, "..", "..", "drizzle");
    await expect(migrate(db, { migrationsFolder })).resolves.not.toThrow();

    const tables = await client<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name like 'experience_%'
      order by table_name
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      "experience_abuse_keys",
      "experience_moderation",
      "experience_schema_meta",
      "experience_submissions",
    ]);
  });
});
