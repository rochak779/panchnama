import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Session 10 addition. Mirrors `tsconfig.json`'s `"@/*": ["./src/*"]` path
 * mapping for Vitest, which (unlike Next.js's own webpack/Turbopack build)
 * does not read `tsconfig.json` `paths` automatically. Only route handlers
 * under `src/app/api/**` import via the `@/` alias (thin wrappers around the
 * injectable core logic in `src/lib/`); this config exists so those files
 * can be imported directly by tests without a separate path-mapping
 * dependency.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
