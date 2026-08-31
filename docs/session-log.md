# Session log

Running log of implementation sessions, per `implementation.md` section 15.
Each entry: goal, files changed, decisions, tests run and results, known
limitations, and next session prerequisites.

---

## Session 0 — Repository bootstrap and governance

**Date:** 2026-08-31
**Goal:** Create a stable monorepo foundation and contributor instructions
(implementation.md section 14, "Session 0").

### Files changed

Everything in the repository except `implementation.md` (pre-existing) and
`.gitignore` (pre-existing, extended). High-level groups:

- Root tooling: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
  `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`,
  `.prettierignore`, `.editorconfig`, `.gitignore` (extended — the existing
  `.firecrawl/` line was preserved), `.env.example`.
- Governance/docs: `README.md`, `AGENTS.md`, `docs/session-log.md` (this
  file), `docs/architecture-decisions/0000-template.md`.
- CI: `.github/workflows/ci.yml`.
- Package scaffolds (`package.json`, `tsconfig.json`, `README.md`,
  `src/index.ts` placeholder export, `src/index.test.ts` passing test):
  `packages/schema`, `packages/audit-core`, `packages/audit-cli`,
  `packages/database`, `packages/ui`.
- `apps/web`: minimal Next.js 15 (App Router) app — `package.json`,
  `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `src/app/layout.tsx`,
  `src/app/page.tsx`, `src/lib/constants.ts` (+ test), `README.md`.
- Directory scaffolding with `README.md` and/or `.gitkeep`:
  `config/` (+ `config/portals/`), `data/` (`seed/`, `raw/`, `evidence/`,
  `review/`, `published/`, `fixtures/`), `docs/research/`, `scripts/`.

### Decisions

- **pnpm workspaces, no Turborepo/Nx.** `pnpm -r --workspace-concurrency=1
run <script>` is enough for the current package count and keeps the
  tool surface small; revisit only if cross-package build graph complexity
  actually appears.
- **ESLint flat config without type-aware linting.** Used
  `typescript-eslint`'s non-type-checked `recommended` config rather than
  `recommendedTypeChecked`, so lint doesn't require a working
  cross-workspace `tsconfig` project graph. Trade-off: some type-aware
  rules (e.g. floating promises) are not caught by lint yet — typecheck
  still catches type errors, just not that lint category. Revisit once
  real logic (async CLI/crawler code) lands.
- **No `eslint-config-next` yet.** Flat-config interop for Next's ESLint
  plugin requires `FlatCompat` bridging that adds real complexity for zero
  behavioral benefit on a placeholder home page. `next build` prints an
  advisory ("Next.js plugin was not detected in your ESLint configuration")
  but does not fail the build. Deferred to Session 11 (frontend
  foundation) when there is real UI code worth Next-specific lint rules.
  Recorded here rather than as a separate ADR since it is a tooling
  default, not a locked product decision.
- **`packages/*` and `apps/web` build/typecheck/test independently** (each
  has its own `tsconfig.json` extending `tsconfig.base.json`, and its own
  `vitest` invocation) rather than a single root Vitest workspace config,
  so each package's test run is isolated and later sessions can give
  packages different test environments (e.g. `jsdom` for future
  React/UI-primitive tests) without root-level config churn.
- **`data/raw/` and `data/evidence/` are git-ignored except for
  `.gitkeep`.** Per section 4.3 ("raw/ … mostly ignored") and section 5.8
  (evidence needs privacy review before it's fit to commit). `data/seed/`,
  `data/review/`, `data/published/`, and `data/fixtures/` are not ignored,
  since those are meant to be human-curated/committed per sections 4.3 and
  9.5.
- **No `docker-compose.yml` yet.** Section 4.3 lists it at the repo root,
  but it only becomes meaningful with Session 9 ("Database foundation"),
  which defines the actual Postgres image, health check, and volume. Adding
  an empty/placeholder compose file now would be scope without substance;
  noted here as an explicit deferral rather than a silent gap.
- **No config files under `config/`** (e.g. `sources.assam.yaml`) yet —
  only the directory and a `README.md` explaining what Session 2 adds.
  Task instructions were explicit that Session 0 creates directory
  structure, not config/schema content.
- **`packageManager` pinned to `pnpm@11.22.0`** (the version already
  installed in this environment) so `corepack`/CI resolve a consistent
  pnpm version. `pnpm-workspace.yaml` also gained an `allowBuilds`
  section (pnpm 10+ build-approval mechanism) after running
  `pnpm approve-builds esbuild` — required for `vitest`'s `esbuild`
  dependency to run its postinstall script.
- **`implementation.md` excluded from Prettier** (`.prettierignore`) since
  it's the pre-existing authoritative spec provided by the user; Session 0
  should not reformat its content as a side effect of running `pnpm
format`.

### Tests run and results

From a clean state (`rm -rf apps/web/.next apps/web/dist packages/*/dist`),
in order:

```
$ pnpm install
Done in 472ms using pnpm v11.22.0   # (re-run after `pnpm approve-builds esbuild`)

$ pnpm lint
$ eslint .
(exit 0, no output — no problems found)

$ pnpm typecheck
$ pnpm -r --workspace-concurrency=1 run typecheck
Scope: 6 of 7 workspace projects
$ tsc -p tsconfig.json --noEmit   (x6 — web, audit-cli, audit-core, database, schema, ui)
(exit 0)

$ pnpm test
$ pnpm -r --workspace-concurrency=1 run test
Scope: 6 of 7 workspace projects
6 test files run (apps/web, packages/audit-cli, audit-core, database, schema, ui)
Test Files  6 passed (6)
     Tests  7 passed (7)   # web has 2 assertions; the 5 packages have 1 each
(exit 0)

$ pnpm build
$ pnpm -r --workspace-concurrency=1 run build
Scope: 6 of 7 workspace projects
apps/web: `next build` — "Compiled successfully", 4/4 static pages generated
packages/*: `tsc -p tsconfig.json` (emits dist/) — all succeed
(exit 0)

$ pnpm format:check
$ prettier --check .
All matched files use Prettier code style!
(exit 0)
```

`packages/ui` is workspace 6 of the reported "6 of 7" (the 7th workspace is
the repo root itself, which has no `test`/`typecheck`/`build` script by
design — `pnpm -r` correctly skips it).

### Known limitations

- No real domain logic exists yet in `packages/schema`, `audit-core`,
  `audit-cli`, `database`, or `ui` — each has only a placeholder export and
  a smoke test, by design (Session 0 scope).
- `apps/web` is a single placeholder page; no design system, no data
  loading, no API routes.
- No Next.js-aware ESLint rules yet (see Decisions above).
- No `docker-compose.yml`, no database, no config registry, no CI beyond
  the four quality gates (no Playwright/accessibility jobs yet — none of
  that exists to test).
- CI (`.github/workflows/ci.yml`) has not been run on GitHub itself (no
  remote configured in this session); it mirrors the exact local commands
  that were verified to pass.

### Next session prerequisites (Session 1 — Domain schemas and fixtures)

- `packages/schema` exists and builds/tests cleanly (this session) — ready
  to receive the real Zod schemas and types from section 5.
- Add `zod` as a dependency of `packages/schema`.
- Populate `docs/data-dictionary.md` (currently does not exist) in sync
  with the schemas, per section 14's Session 1 description.
- No other package should duplicate domain types — `packages/audit-core`,
  `audit-cli`, `database`, `ui`, and `apps/web` should import from
  `@panchnama/schema` once it has real exports.
