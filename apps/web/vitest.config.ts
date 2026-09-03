import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

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
  // Session 11: component tests use JSX. Vite's default esbuild transform
  // needs an explicit "automatic" runtime (importing from
  // react/jsx-runtime) — without this it emits classic React.createElement
  // calls with no React import in scope, since this codebase never imports
  // `React` itself (React 19 + the automatic JSX runtime, matching Next's
  // own default).
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Default environment stays "node" (matches Session 10's lib/route
    // tests, which use the platform Request/Response and would break under
    // jsdom, which does not implement fetch's Request/Response). Session
    // 11's component tests opt into jsdom per-file with a
    // `// @vitest-environment jsdom` docblock instead of flipping this
    // globally.
    setupFiles: ["./vitest.setup.ts"],
    // Session 19: `e2e/**` holds Playwright specs, which use their own
    // `test`/`expect` from `@playwright/test` and are run only by
    // `playwright test` (`pnpm run test:e2e`). Without this exclude,
    // Vitest's default include glob also picks up `e2e/*.spec.ts` and
    // fails because those files call Playwright's `test()`, which refuses
    // to run outside the Playwright runner.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
