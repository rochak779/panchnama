import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { DEFAULT_ABUSE_KEY_TTL_HOURS, DEFAULT_RETENTION_REJECTED_DAYS } from "./constants.js";

/**
 * Startup-time environment validation for this package only. Every field is
 * optional at the Zod layer — importing `@panchnama/database` (or running
 * an unrelated `pnpm audit ...` command from Sessions 2-8) must never throw
 * just because no database is configured. `requireDatabaseUrl()` below is
 * what actually fails fast, and only when a DB-dependent command calls it.
 *
 * `DATABASE_URL` (a single Postgres connection string) is used rather than
 * discrete `PGHOST`/`PGPORT`/... variables because it is what the
 * `postgres` (postgres.js) client and Drizzle Kit both accept natively as
 * one value, which keeps `.env.local`, `docker-compose.yml`, and
 * `drizzle.config.ts` all pointing at the same single source of truth.
 */
const envSchema = z.object({
  /** Local/dev/preview/production database connection string. */
  DATABASE_URL: z.string().min(1).optional(),
  /** Separate database used only by this package's integration tests
   * (implementation.md section 9.5's "separate local, test, preview, and
   * production databases"). Falls back to DATABASE_URL only for
   * `db:check`'s generic reachability probe, never for the test suite
   * itself — the test suite refuses to run against a URL that looks like
   * the dev database (see src/repository/testDb.ts). */
  TEST_DATABASE_URL: z.string().min(1).optional(),
  /** Reserved for Session 10's rate-limiting HMAC of request IPs
   * (implementation.md section 9.6). Unused by any code in this session —
   * no code path in `packages/database` reads this value yet. Declared
   * here now so the env-var naming convention exists before Session 10
   * needs it. */
  EXPERIENCE_ABUSE_KEY_SECRET: z.string().min(1).optional(),
  EXPERIENCE_RETENTION_REJECTED_DAYS: z.coerce.number().int().positive().optional(),
  EXPERIENCE_ABUSE_KEY_TTL_HOURS: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Loads `.env.local` (falling back to `.env`) into `process.env` using
 * Node's built-in loader (Node >=20.6), then validates the recognised
 * subset. Safe to call repeatedly and safe to call when no env file exists
 * at all — this must never throw for commands that don't touch the
 * database (Sessions 2-8's `pnpm audit ...` commands, `pnpm lint`, etc).
 *
 * Searches from `process.cwd()` upward through parent directories (up to
 * 6 levels) for the env file, rather than only `process.cwd()` itself —
 * `pnpm --filter @panchnama/database run ...` (used by every root
 * `db:*`/`experiences:*` script) runs with cwd set to
 * `packages/database/`, but `.env.local` conventionally lives at the repo
 * root, so a plain relative lookup would silently miss it.
 */
export function loadEnv(): Env {
  for (const file of [".env.local", ".env"]) {
    const path = findUpward(file);
    if (!path) continue;
    try {
      process.loadEnvFile(path);
    } catch {
      // Already loaded, or unreadable — not fatal for commands that don't
      // need a database at all.
    }
  }
  return envSchema.parse(process.env);
}

function findUpward(fileName: string, maxLevels = 6): string | undefined {
  let dir = process.cwd();
  for (let level = 0; level <= maxLevels; level += 1) {
    const candidate = join(dir, fileName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL, " +
        "or run `pnpm db:up` first if you're using the default local Docker Compose service.",
    );
    this.name = "MissingDatabaseUrlError";
  }
}

/** Fails fast with a clear, typed error for DB-dependent commands only. */
export function requireDatabaseUrl(env: Env = loadEnv()): string {
  if (!env.DATABASE_URL) {
    throw new MissingDatabaseUrlError();
  }
  return env.DATABASE_URL;
}

export class MissingTestDatabaseUrlError extends Error {
  constructor() {
    super(
      "TEST_DATABASE_URL is not set. Integration tests in @panchnama/database require a " +
        "dedicated test Postgres database — see packages/database/README.md.",
    );
    this.name = "MissingTestDatabaseUrlError";
  }
}

export function getRetentionRejectedDays(env: Env = loadEnv()): number {
  return env.EXPERIENCE_RETENTION_REJECTED_DAYS ?? DEFAULT_RETENTION_REJECTED_DAYS;
}

export function getAbuseKeyTtlHours(env: Env = loadEnv()): number {
  return env.EXPERIENCE_ABUSE_KEY_TTL_HOURS ?? DEFAULT_ABUSE_KEY_TTL_HOURS;
}
