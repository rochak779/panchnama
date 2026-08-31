import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  /** Underlying postgres.js client, exposed for the rare case a caller
   * needs a raw connection (e.g. a health-check `SELECT 1`). */
  client: Sql;
  /** Closes the connection pool. Always call this from CLI scripts before
   * `process.exit`, and from test teardown — postgres.js otherwise keeps
   * the process alive on an open socket. */
  close: () => Promise<void>;
}

/**
 * Single well-documented way to obtain a Drizzle client, usable two ways:
 *
 * - CLI / test usage (this session): call this once per short-lived
 *   process/test file with `{ max: 1 }` (the default) and always `close()`
 *   before exit.
 * - Future Next.js runtime usage (Session 10+, not built this session): a
 *   Node.js server runtime (API routes, route handlers) can call this once
 *   at module scope and reuse the returned `db` across requests with a
 *   larger `max` (a real pool) — postgres.js pools internally, so this is
 *   safe to hold as a singleton for the life of a long-running Node
 *   process. It is NOT safe to call this per-request in an edge/serverless
 *   runtime that recycles the process on every invocation (Vercel Edge
 *   Functions do not support raw TCP sockets at all); if Session 10 ever
 *   targets an edge runtime for these routes, it will need either a
 *   different (HTTP-based) Postgres driver or to keep experience-API
 *   routes on the Node.js runtime. That decision belongs to Session 10;
 *   this function only avoids baking in anything that would make the
 *   Node.js-runtime path harder later.
 */
export function createDbClient(connectionString: string, options?: { max?: number }): DbHandle {
  const client = postgres(connectionString, {
    max: options?.max ?? 1,
    onnotice: () => {
      // Suppress postgres.js NOTICE logging (e.g. from DO blocks in
      // migrations) — never a place free text could leak, but keeping
      // stdout quiet and predictable for the CLI commands.
    },
  });
  const db = drizzle(client, { schema });
  return {
    db,
    client,
    close: () => client.end({ timeout: 5 }),
  };
}
