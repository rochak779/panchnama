// @ts-check
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * Session 11: `eslint-config-next` still ships only an eslintrc-shaped
 * config, so it needs `FlatCompat` to bridge into this repo's flat config
 * (deferred from Session 0 — see docs/session-log.md Session 0's "No
 * eslint-config-next yet" decision — until there was real UI code worth
 * Next-specific lint rules). Scoped to `apps/web/**` only, below, so the
 * rest of the monorepo (CLI packages, database, schema) is unaffected.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "data/raw/**",
      "data/evidence/**",
      "**/*.tsbuildinfo",
      "**/next-env.d.ts",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Node-executed scripts (run via `node` or `pnpm exec`, not bundled by
    // Next) need Node globals (process, console) that the app's browser/JSX
    // lint scope below doesn't provide.
    files: ["apps/web/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },
  ...compat.config({ extends: ["next/core-web-vitals"] }).map((config) => ({
    ...config,
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    // `no-html-link-for-pages` otherwise assumes the Next app lives at the
    // repo root; this monorepo's app is at `apps/web/`.
    settings: { ...config.settings, next: { ...config.settings?.next, rootDir: "apps/web/" } },
  })),
  eslintConfigPrettier,
);
