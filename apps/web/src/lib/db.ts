import {
  createDbClient,
  loadEnv,
  MissingDatabaseUrlError,
  type Db,
  type DbHandle,
} from "@panchnama/database";

/**
 * Module-scope singleton Drizzle client for this Node.js-runtime Next.js
 * app, per `packages/database/src/client.ts`'s documented "Future Next.js
 * runtime usage" guidance: call `createDbClient` once and reuse `db`
 * across requests. These routes must stay on the Node.js runtime (not
 * edge) — `createDbClient` uses `postgres.js`, a raw-TCP-socket driver
 * edge/serverless runtimes generally cannot use.
 *
 * `getDbHandle()` never throws for a missing `DATABASE_URL`; it returns
 * `undefined` so callers can produce a clean 503 instead of crashing the
 * process (implementation.md section 9.8: "If the database is unavailable,
 * the audit scorecard remains readable").
 */
let handle: DbHandle | undefined;
let attempted = false;

export function getDbHandle(): DbHandle | undefined {
  if (!attempted) {
    attempted = true;
    try {
      const env = loadEnv();
      if (env.DATABASE_URL) {
        handle = createDbClient(env.DATABASE_URL, { max: 5 });
      }
    } catch (error) {
      if (!(error instanceof MissingDatabaseUrlError)) {
        throw error;
      }
    }
  }
  return handle;
}

export function getDb(): Db | undefined {
  return getDbHandle()?.db;
}

/** Test-only reset, so tests that inject their own `Db` via dependency
 * injection (see each route's `createXHandler(deps)` factory) never
 * accidentally reuse a singleton left over from a previous test file. */
export function resetDbHandleForTests(): void {
  handle = undefined;
  attempted = false;
}
