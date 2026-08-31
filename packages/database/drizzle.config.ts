import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineConfig } from "drizzle-kit";

// Load .env.local/.env the same way src/env.ts does (searching upward from
// cwd, since this file may run from the repo root or from
// packages/database/), so `drizzle-kit generate`/`studio` also see
// DATABASE_URL without a developer having to export it manually.
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
for (const file of [".env.local", ".env"]) {
  const path = findUpward(file);
  if (!path) continue;
  try {
    process.loadEnvFile(path);
  } catch {
    // optional
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://panchnama:panchnama@localhost:5432/panchnama",
  },
});
