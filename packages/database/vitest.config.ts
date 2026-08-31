import { defineConfig } from "vitest/config";

/**
 * This package's `*.integration.test.ts` files share one real
 * TEST_DATABASE_URL Postgres database (see src/testSupport/testDb.ts).
 * `migration.integration.test.ts` in particular drops and recreates every
 * table this package owns, which must never interleave with another test
 * file's queries — so file-level parallelism is disabled for this package
 * only. Individual `it()` blocks within a file still run sequentially by
 * default (Vitest does not parallelize tests within one file unless
 * `concurrent` is used, which nothing here does).
 */
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
