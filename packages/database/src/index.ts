/**
 * @panchnama/database
 *
 * Session 9: Drizzle schema, migrations, connection lifecycle, and typed
 * repository functions for anonymous citizen-experience submissions and
 * their offline moderation (implementation.md section 9.5). This package
 * exists only for citizen-experience persistence — crawler and audit
 * observations from `packages/audit-cli`/`packages/audit-core` are never
 * moved into PostgreSQL, and no code in this package reads from or writes
 * to `data/published/`, `data/review/`, `data/raw/`, or any audit schema.
 */

/** Package identifier, used by other packages/tests to confirm resolution. */
export const PACKAGE_NAME = "@panchnama/database" as const;

export * from "./constants.js";
export * from "./env.js";
export * from "./errors.js";
export * from "./client.js";
export * from "./schema/index.js";
export * from "./repository/index.js";
export * from "./fixtures/portals.js";
