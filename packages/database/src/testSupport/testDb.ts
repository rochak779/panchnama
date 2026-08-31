import { sql } from "drizzle-orm";
import { loadEnv } from "../env.js";
import { createDbClient, type DbHandle } from "../client.js";
import {
  experienceAbuseKeys,
  experienceModeration,
  experienceSubmissions,
} from "../schema/index.js";

/**
 * Test-database plumbing shared by every `*.integration.test.ts` file in
 * this package.
 *
 * Strategy: these are genuinely real integration tests against a real
 * Postgres database (no mocked Drizzle/postgres.js — mocking would defeat
 * the point of a "production-shaped persistence layer" session). They
 * require `TEST_DATABASE_URL` to point at a reachable, already-migrated
 * Postgres database, separate from `DATABASE_URL`
 * (implementation.md section 9.5's "separate local, test, preview, and
 * production databases"). A developer/CI sets this up with:
 *
 *   pnpm db:up                                        # start local Postgres
 *   DATABASE_URL=... pnpm db:migrate                  # migrate the dev DB
 *   TEST_DATABASE_URL=... pnpm --filter @panchnama/database exec \
 *     tsx src/scripts/migrate.ts                       # migrate the test DB
 *   pnpm test                                          # or: pnpm --filter @panchnama/database test
 *
 * If `TEST_DATABASE_URL` is missing or unreachable, every integration test
 * in this package is skipped (not failed) with a clear console warning —
 * so `pnpm test` at the repo root stays green for a contributor who hasn't
 * set up Postgres, while a developer/CI that HAS configured
 * `TEST_DATABASE_URL` gets a real run against real Postgres. This is a
 * deliberate tradeoff: see docs/session-log.md's "test-database strategy"
 * note for the CI implication (CI must provision a Postgres service and
 * export TEST_DATABASE_URL for these tests to actually execute).
 */

let cached: { available: boolean; handle?: DbHandle } | undefined;

export async function getTestDbAvailability(): Promise<boolean> {
  if (cached) return cached.available;

  const env = loadEnv();
  if (!env.TEST_DATABASE_URL) {
    console.warn(
      "[@panchnama/database] TEST_DATABASE_URL is not set — skipping integration tests. " +
        "See packages/database/README.md.",
    );
    cached = { available: false };
    return false;
  }
  if (env.DATABASE_URL && env.TEST_DATABASE_URL === env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must not equal DATABASE_URL — integration tests truncate tables and " +
        "must never run against the development database.",
    );
  }

  const handle = createDbClient(env.TEST_DATABASE_URL, { max: 5 });
  try {
    await handle.client`select 1`;
  } catch (error) {
    console.warn(
      `[@panchnama/database] TEST_DATABASE_URL is set but unreachable — skipping integration tests: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    await handle.close();
    cached = { available: false };
    return false;
  }

  cached = { available: true, handle };
  return true;
}

export function getTestDb(): DbHandle {
  if (!cached?.handle) {
    throw new Error("getTestDb() called before getTestDbAvailability() confirmed availability.");
  }
  return cached.handle;
}

/** Clears all rows this test suite could have written, between tests.
 * Never touches `experience_schema_meta` (not test data; migration
 * metadata). */
export async function truncateExperienceTables(): Promise<void> {
  const { db } = getTestDb();
  await db.execute(sql`TRUNCATE TABLE ${experienceModeration} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${experienceSubmissions} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${experienceAbuseKeys} CASCADE`);
}

export async function closeTestDb(): Promise<void> {
  if (cached?.handle) {
    await cached.handle.close();
  }
  cached = undefined;
}
