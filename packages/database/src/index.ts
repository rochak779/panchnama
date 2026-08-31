/**
 * @panchnama/database
 *
 * Placeholder entry point. Session 9 ("Database foundation and moderation
 * storage") will populate this package with the Drizzle schema, migrations,
 * and typed repository functions for anonymous experience submissions,
 * moderation records, and abuse keys (implementation.md section 9.5).
 *
 * This package exists only for citizen-experience persistence. Crawler and
 * audit observations must never be moved into PostgreSQL in version one.
 */

/** Package identifier, used by other packages/tests to confirm resolution. */
export const PACKAGE_NAME = "@panchnama/database" as const;
