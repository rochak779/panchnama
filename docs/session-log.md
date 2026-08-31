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

---

## Session 1 — Domain schemas and fixtures

**Date:** 2026-08-31
**Goal:** Make the data contract executable before writing crawler or UI
code (implementation.md section 14, "Session 1"): implement every
enumeration and entity from section 5 as Zod schemas with inferred
TypeScript types, valid and invalid fixtures, and a data dictionary.

### Files changed

- `packages/schema/package.json`: added `zod` as a runtime dependency.
- `packages/schema/src/common.ts` (new): `stableId` (URL-safe ID schema),
  `schemaVersionField` + `SCHEMA_VERSIONS` constants and the migration
  convention note, `isoTimestamp`, `urlString`, `nonEmptyString`, and the
  documented unknown-field (`.strict()`) policy.
- `packages/schema/src/enums.ts` (new): every enum from §5.1, §5.8, §5.12
  (`OfficialStatus`, `TechnicalHealth`, `ContinuingRole`, `SuggestedAction`,
  `Severity`, `Confidence`, `ReviewStatus`, `CheckStatus`, `EvidenceType`,
  `ExperienceStatus`, `TaskOutcome`, `ExperienceTheme`).
- One file per entity (new): `inventory-source.ts`, `portal.ts`,
  `audit-run.ts`, `observation.ts` (Page + Link), `finding.ts`,
  `evidence.ts`, `overlap.ts`, `published-assessment.ts`, `review.ts`,
  `experience.ts` (Submission + Summary) — each a `.strict()` Zod object
  schema with an inferred TypeScript type, matching §5's field names,
  optionality, and nesting.
- `packages/schema/src/index.ts` (rewritten): barrel re-export of every
  file above; `PACKAGE_NAME` export preserved.
- `packages/schema/src/fixtures/valid.ts` (new): one internally-consistent
  valid fixture per entity (12 fixtures forming one small audit-run story),
  as typed TypeScript values (not JSON) so drift is caught by `tsc` too.
- Test files (new, one per entity plus one cross-cutting):
  `inventory-source.test.ts`, `portal.test.ts`, `audit-run.test.ts`,
  `observation.test.ts`, `evidence.test.ts`, `finding.test.ts`,
  `overlap.test.ts`, `published-assessment.test.ts`, `review.test.ts`,
  `experience.test.ts`, `roundtrip.test.ts`. 64 tests total (`index.test.ts`
  from Session 0 kept as-is, still passing).
- `packages/schema/README.md`: updated status from "scaffold only" to
  implemented, with pointers to `common.ts`, `fixtures/valid.ts`, and the
  data dictionary.
- `docs/data-dictionary.md` (new): hand-maintained reference covering every
  enum (values + meaning) and every entity (fields, types, optionality,
  description), explicitly marked as a hand-maintained mirror of
  `packages/schema`, synchronized in this same commit.

### Decisions

- **File layout: one file per major entity, barrel-exported from
  `index.ts`.** Chosen over one giant `index.ts` for navigability, per the
  task's own suggestion; `observation.ts` and `experience.ts` each hold two
  closely-related entities (Page/Link observation; Submission/Summary)
  rather than splitting further, since they're always used together.
- **`schemaVersion` added to every top-level record**, including the ones
  where §5's interface doesn't literally show it (all except `AuditRun`),
  per the cross-cutting rule in §5's preamble. Kept as a plain non-empty
  `z.string()` (not a `z.literal` pinned to the current version) so an
  older-but-parseable record doesn't fail purely on this field; version
  constants live in `SCHEMA_VERSIONS` in `common.ts` for callers that want
  to compare against the current version explicitly.
- **`stableId`** is a single reusable `z.string().min(1).regex(...)` schema
  requiring the RFC 3986 unreserved URL character set
  (`A-Z a-z 0-9 - . _ ~`), reused for every ID-shaped field. The
  "never use array indexes as IDs" half of the rule is documented as a
  process rule in a code comment (not structurally enforceable by Zod).
- **Unknown-field policy: `.strict()` everywhere**, at every nesting level
  (including embedded objects like `Portal.discovery[]` entries and
  `PublishedPortalAssessment.crawlCoverage`). Chosen over Zod's default
  silent-strip because this domain is explicitly a reproducible evidence
  trail (§1.6 principle 7); a schema/producer mismatch should be a loud
  validation failure, not silently dropped data. Documented in
  `common.ts` and tested directly (e.g.
  `inventory-source.test.ts`/`experience.test.ts` "rejects an unknown
  field" cases) and indirectly by every other test using object spreads
  that only ever add/replace known keys.
- **`ReviewDecision` gets a `schemaVersion` despite having no `id` field in
  §5.11.** It's keyed by `findingId` (one decision per finding) but is
  still a top-level stored record per the cross-cutting rule; documented in
  a code comment in `review.ts`.
- **`urlString` uses `z.string().url()`** rather than re-encoding the crawl
  policy's HTTP/HTTPS-only scheme restriction (§6.5/§12.1) at the schema
  layer — that restriction is a crawl-time policy concern for a later
  session's config/crawler layer, which can layer a stricter check on top.
- **AuditRun status/count derivation rule** ("`completed`, `partial`, and
  `failed` must be derived consistently from those counts") is not spelled
  out exactly in §5.14, so this package's specific interpretation is
  documented in code: `completed` ⇒ all portals succeeded; `failed` ⇒ none
  succeeded; `partial` ⇒ a genuine mix. If a future session's real pipeline
  needs different boundary semantics (e.g. treating 0-portal runs
  specially), revisit this refinement, not the underlying rule.
- **Fixtures are TypeScript, not JSON**, per the task's stated preference,
  specifically so an accidental type-shape edit is caught by `tsc` in
  addition to the `.parse()` calls in tests.

### §5.14 invariants: what's enforced vs. deferred

**Enforced via `.refine()`/`.superRefine()` (single-record checkable):**

- `Finding`: `overlapComparisonId` required when `category ===
"possible_overlap"`.
- `Finding`: `evidenceRefs` non-empty (finding must reference evidence).
- `Finding`: `checkStatus === "not_assessable"` requires non-empty
  `limitations` (this package's reading of "must include a reason" for the
  one entity here where a bare `not_assessable` needs a reason field).
- `PortalOverlapComparison`: `portalIdA !== portalIdB`.
- `PortalOverlapComparison`: `evidenceRefs` non-empty.
- `AuditRun`: `portalsSucceeded + portalsFailed + portalsPartial ===
portalCount`.
- `AuditRun`: `completedAt` required once `status !== "running"`.
- `AuditRun`: status/count consistency (see Decisions above).
- `LinkObservation`: `status === "not_assessable"` requires `errorCode`.
- `PublishedPortalAssessment`: `technicalHealth === "healthy"` requires no
  `reviewedFindings` entry with `reviewStatus === "reviewed"` and severity
  in `{critical, significant}` — checkable because `reviewedFindings` is
  embedded directly in this record.
- `PublishedPortalAssessment`: `technicalHealth === "not_assessable"`
  requires a non-empty `crawlCoverage.coverageNote`.

**Deferred as out of scope for this session (need cross-record lookups this
session's schemas don't have the record set to check against; each is
marked with a `// TODO(session-N: ...)` comment at its schema):**

- `Portal`: "a published portal must reference at least one inventory
  source" — needs the real `InventorySource` set. → ingestion/publish
  (sessions 3, 8).
- `Finding`: evidence refs resolving to real, `privacyReviewed: true`
  `EvidenceArtifact` records; the overlap-comparison relationship/run/
  portal/conclusion cross-checks; review-decision presence for
  interpretive findings; "`review_retirement` cannot be generated from
  technical failure alone" (needs the full finding/evidence set). → review
  pipeline (session 8).
- `EvidenceArtifact`: "an artifact with `privacyReviewed: false` must never
  be reachable from a published finding" — constrains which findings may
  cite it, not the artifact record itself. → publish gate (session 8).
- `PortalOverlapComparison`: both portal IDs resolving to real `Portal`
  records; referenced evidence being `privacyReviewed: true`. → publish
  pipeline (session 8).
- `PublishedPortalAssessment`: "every exported result must include audit
  date, methodology version, and limitations" — needs the referenced
  `AuditRun`. → publish/export pipeline (session 8).
- `ReviewDecision`: "review overrides must preserve the original automated
  value" — needs the reviewed `Finding`'s original values. → review
  pipeline (session 8).
- `ExperienceSubmission`: "cannot be publicly returned unless
  `consentToPublish` is true and `status` is `approved`" (a read-API rule,
  not a stored-record shape rule); "must reference an existing published
  portal ID" (needs the published portal set); "rejected and pending
  submissions never contribute to public aggregates" (an aggregation-time
  rule). → submission API / experience pipeline (sessions 9, 10).
- `AuditRun.unavailable` requiring "the configured number of failed
  attempts" — needs crawl-policy configuration, which doesn't exist until
  Session 2.

Also out of scope, not §5.14 invariants but noted for completeness: no
migration function exists yet (only a documented convention — see
`common.ts`), since every entity is still at its first schema version.

### Tests run and results

```
$ pnpm install
Done in 3.6s using pnpm v11.22.0   # (added zod to packages/schema)

$ pnpm lint
$ eslint .
(exit 0, no output)

$ pnpm typecheck
$ pnpm -r --workspace-concurrency=1 run typecheck
Scope: 6 of 7 workspace projects
(6x `tsc -p tsconfig.json --noEmit`, exit 0)

$ pnpm test
$ pnpm -r --workspace-concurrency=1 run test
Scope: 6 of 7 workspace projects
packages/schema: 12 test files, 64 tests passed
(all other packages: 1 test each, unchanged from Session 0)
Test Files  17 passed (17) across the workspace
     Tests  70 passed (70) across the workspace
(exit 0)

$ pnpm build
$ pnpm -r --workspace-concurrency=1 run build
Scope: 6 of 7 workspace projects
apps/web: `next build` — "Compiled successfully", 4/4 static pages generated
packages/*: `tsc -p tsconfig.json` (emits dist/) — all succeed, including
  packages/schema now emitting real schema/type declarations
(exit 0)

$ pnpm format:check
$ prettier --check .
All matched files use Prettier code style!
(exit 0)
```

### Known limitations

- No config loading, YAML parsing, or `config/sources.assam.yaml` yet — the
  schemas exist, but nothing reads real source/portal/crawl-policy data
  through them yet. That's Session 2.
- No crawler, CLI commands, or database exist yet — `packages/audit-core`,
  `audit-cli`, and `database` are still Session 0 placeholders that should
  import from `@panchnama/schema` once they have real logic.
- The cross-record §5.14 invariants listed above are genuinely unchecked at
  runtime until a later session's pipeline validates the full record set;
  a single malformed-but-internally-consistent record will currently pass
  `.parse()` even if it references a nonexistent evidence artifact, portal,
  or overlap comparison.
- `AuditRun`'s status/count derivation rule is this package's own
  interpretation (see Decisions) since §5.14's wording doesn't spell out
  the exact boundary; flag for review if a future session's real audit
  pipeline needs different semantics.

### Next session prerequisites (Session 2 — Configuration and source registry)

- `packages/schema` now has real, tested domain schemas — Session 2's
  config/source-registry schemas should live in `packages/schema` (per
  section 14) and reuse `stableId`, `urlString`, `isoTimestamp`, etc. from
  `common.ts` rather than redefining string primitives.
- Session 2 needs to add: schemas for source, crawl, check, and portal
  override configuration; YAML parsing and semantic validation;
  `config/sources.assam.yaml` with placeholders or verified initial
  sources; default crawl/check policy files; source snapshot metadata
  conventions; `sources:validate`; documentation for adding sources without
  editing code.
- Session 2's config-digest work can reuse `AuditRun`'s existing
  `sourceRegistryDigest` / `crawlPolicyDigest` / `checkConfigDigest` fields
  as the target shape it needs to populate.
- No config files exist under `config/` yet beyond the Session 0
  placeholder `README.md` — Session 2 creates the real YAML.

## Session 2 — Configuration and source registry

### Files changed

- `packages/audit-cli/src/config/common.ts` — shared config primitives
  (`httpUrlString`, `supportedGeographySchema`) plus the design-decision
  writeup for where config schemas live (see "Decisions" below).
- `packages/audit-cli/src/config/source-registry.ts` — `sourceEntrySchema`,
  `sourceRegistryConfigSchema`, `findDuplicateSourceIds`.
- `packages/audit-cli/src/config/crawl-policy.ts` — `crawlPolicyConfigSchema`
  (implementation.md §6.1–6.6).
- `packages/audit-cli/src/config/checks.ts` — `checkEntrySchema`,
  `checksConfigSchema`, `findDuplicateRuleIds` (§7).
- `packages/audit-cli/src/config/portal-override.ts` —
  `portalOverrideConfigSchema` for `config/portals/*.yaml`.
- `packages/audit-cli/src/config/digest.ts` — `canonicalize`,
  `canonicalJsonStringify`, `computeConfigDigest` (§9.4).
- `packages/audit-cli/src/config/load.ts` — `loadYamlConfig`: reads +
  parses YAML + validates against a Zod schema, returns `{ ok, issues }`
  with file/path/reason detail; never throws.
- `packages/audit-cli/src/config/validate.ts` — `validateAllConfig`,
  `defaultConfigPaths`: full config validation pass across
  `sources.assam.yaml`, `crawl-policy.yaml`, `checks.yaml`, and every
  `config/portals/*.yaml`.
- `packages/audit-cli/src/config/index.ts` — re-exports.
- `packages/audit-cli/src/commands/sources-validate.ts` —
  `runSourcesValidate`: the `sources:validate` command implementation
  (pure function: config dir in, `{ exitCode, lines }` out).
- `packages/audit-cli/src/cli.ts` — `runCli`: argv dispatcher, currently
  handling only `sources:validate` (plus an optional `--config-dir` flag
  used by tests/manual verification).
- `packages/audit-cli/src/bin.ts` — process entry point (`console.info` +
  `process.exit`), wired as the package's `bin`.
- `packages/audit-cli/src/index.ts` — rewritten from the Session 0
  placeholder into the library entry point, re-exporting the config module,
  `runSourcesValidate`, and `runCli`.
- `packages/audit-cli/package.json` — `bin` now points at `dist/bin.js`;
  added `"start": "node dist/bin.js"`; added dependencies on
  `@panchnama/schema` (workspace), `zod`, `yaml`.
- Tests: `source-registry.test.ts`, `crawl-policy.test.ts`, `checks.test.ts`,
  `portal-override.test.ts`, `digest.test.ts`, `validate.test.ts` (loads the
  real `config/*.yaml` files plus fixture-based broken-config cases in a
  temp dir), `commands/sources-validate.test.ts` (exit-code behavior against
  real config and a broken fixture).
- `package.json` (root) — added `"audit": "pnpm --filter @panchnama/audit-cli run start"`.
- `config/sources.assam.yaml` (new) — 3 placeholder Assam source entries.
- `config/crawl-policy.yaml` (new) — literal §6.1–6.6 defaults.
- `config/checks.yaml` (new) — the 5 illustrative §7.1 rules, enabled.
- `config/portals/README.md` (new, replaces `.gitkeep`) — override-file
  format documentation.
- `config/README.md` — updated with the real validate command and pointer
  to `docs/adding-sources.md`.
- `docs/adding-sources.md` (new) — non-engineer guide to adding a source.

### Decisions

**Where config schemas live.** Put in `packages/audit-cli/src/config/`,
not `packages/schema`. Reasoning: `packages/schema`'s own documented scope
is "shared Zod schemas ... for every domain record defined in
implementation.md section 5" — the stored/published entity model. Crawl
policy, check thresholds, and the source registry are operational
configuration for the CLI pipeline (§6, §7, §9), a different kind of thing
from a domain record, and nothing outside `audit-cli` currently needs to
read it (the web app consumes published data, not raw pipeline config).
Config schemas do import and reuse `packages/schema`'s primitives
(`stableId`, `nonEmptyString`, `schemaVersionField`) rather than
redefining them, so there is one source of truth for those primitives even
though the composite config schemas live elsewhere. If a later session
needs these shapes from another package, promote them to
`packages/schema/src/config/` then, rather than pre-emptively duplicating
now. Full reasoning is also inlined as a comment in `config/common.ts`.

**`pnpm audit <command>` wiring, and a real conflict found.**
implementation.md §9.1 specifies `pnpm audit sources:validate` verbatim.
`pnpm` itself reserves `audit` as a built-in subcommand (its own
supply-chain security audit, unrelated to this project) that intercepts
`pnpm audit ...` **before** pnpm checks `package.json` scripts — so the
literal command from the spec does not resolve to our script and instead
fails with `ERR_PNPM_AUDIT_UNKNOWN_SUBCOMMAND`. This is a genuine
repository/tooling constraint, not a workaround-able implementation
choice. Smallest safe adjustment: keep the script named `audit` in root
`package.json` (closest match to spec intent) and document that it must be
invoked as `pnpm run audit sources:validate` (explicit `run` bypasses
pnpm's built-in interception). All config file header comments,
`config/README.md`, and `docs/adding-sources.md` use this corrected
command. Wiring: root `"audit": "pnpm --filter @panchnama/audit-cli run
start"` → package script `"start": "node dist/bin.js"` → `src/bin.ts` →
`src/cli.ts`'s `runCli` → `sources:validate` → `runSourcesValidate`.

**Digest algorithm.** One `computeConfigDigest(value)` in
`config/digest.ts`, reused for all three of `AuditRun`'s
`sourceRegistryDigest` / `crawlPolicyDigest` / `checkConfigDigest` fields
(defined in `@panchnama/schema`, not populated by this session — no
`AuditRun` is created until the crawler exists). Algorithm: recursively
sort object keys (`canonicalize`), `JSON.stringify` the result
(`canonicalJsonStringify`), then SHA-256 hex-digest via `node:crypto`.
Deliberately does NOT reorder array elements — element order in a YAML
list (source priority, check ordering) is meaningful and a digest that
ignored it would hide a real content change. Verified deterministic
against key-order permutations (including nested objects) and sensitive to
actual content/array-order changes; see `digest.test.ts`.

**Source-registry config vs. `InventorySource`.** Config
(`sourceRegistryConfigSchema`) omits `retrievedAt` and `evidencePath`
(populated at ingestion, Session 3) and adds `enabled` (lets a non-engineer
disable a source without deleting its history). Documented inline in
`source-registry.ts` and in `docs/adding-sources.md`.

**YAML library.** `yaml` (not `js-yaml`): actively maintained, native
TypeScript types, no separate `@types/js-yaml` dependency needed.

### Tests run and results

```
$ pnpm --filter @panchnama/audit-cli run test
 ✓ src/config/digest.test.ts (6 tests)
 ✓ src/config/portal-override.test.ts (5 tests)
 ✓ src/config/checks.test.ts (7 tests)
 ✓ src/config/crawl-policy.test.ts (8 tests)
 ✓ src/config/source-registry.test.ts (12 tests)
 ✓ src/commands/sources-validate.test.ts (3 tests)
 ✓ src/config/validate.test.ts (7 tests)   # loads the real config/*.yaml files
 ✓ src/index.test.ts (1 test)
 Test Files  8 passed (8) / Tests  49 passed (49)

$ pnpm lint        # eslint . — exit 0, no output
$ pnpm typecheck   # 6 workspace projects, tsc --noEmit — exit 0
$ pnpm test        # 8 workspace test suites, 117 tests total — all passed
$ pnpm build       # apps/web (next build, 4/4 static pages) + 5 packages (tsc) — exit 0
$ pnpm format:check  # prettier --check . — "All matched files use Prettier code style!"
```

Manual `sources:validate` verification:

```
$ pnpm run audit sources:validate
> pnpm --filter @panchnama/audit-cli run start sources:validate
> node dist/bin.js sources:validate
sources:validate PASSED
  sources: 3
  portal overrides: 0
  sourceRegistryDigest: 952d78cd49abd51a4ed4d8c91f8b0502acd33ff81b5cbe45a25e344c18fa2597
  crawlPolicyDigest: a6b583170998f48b69985e11518486a51686290233cfbb023b595e882d605036
  checkConfigDigest: 396729e2496e7a21bc3b1700f6e79ce6d0048c58aa3763c0dc5bc3f45efe74b5
(exit code 0)

$ node dist/bin.js sources:validate --config-dir <broken-temp-dir>
# temp dir: geography "kerala" (invalid), duplicate source id "dup",
# an invalid/non-http(s) URL, and missing crawl-policy.yaml/checks.yaml
sources:validate FAILED — 5 issue(s):
  - <tmp>/sources.assam.yaml [geography]: Invalid literal value, expected "assam"
  - <tmp>/sources.assam.yaml [sources.0.url]: Invalid url
  - <tmp>/sources.assam.yaml [sources.0.url]: url must use the http or https scheme
  - <tmp>/crawl-policy.yaml [(file)]: file does not exist
  - <tmp>/checks.yaml [(file)]: file does not exist
(exit code 1)
```

No network activity occurred at any point in this session.

### Known limitations (deferred checks, explicit)

- **Portal-override cross-check deferred.** `config/portals/*.yaml`
  `portalId` is validated for shape only (a `stableId`-shaped string); it
  is never checked against a real `Portal` record because no `Portal`
  records exist until Session 3. No override files exist yet either
  (`config/portals/` currently holds only `README.md`).
- **Source registry is placeholder content.** All 3 entries in
  `config/sources.assam.yaml` are illustrative/well-known Assam government
  entry points, explicitly marked as unverified in the file's header
  comment. Session 17 must independently re-verify every URL, name, and
  authority attribution before this registry drives a live crawl. No
  network fetch or verification happened in this session.
- **`checks.yaml` rule catalog is not closed.** `ruleId` is validated as a
  `stableId`-shaped string, not an enum of every rule Session 7 will
  eventually implement; a typo'd rule ID that happens to be URL-safe will
  pass this session's validation and only surface as unrecognized when
  Session 7's rule engine tries to resolve it.
- **`parameters`/`overrides` are structurally, not semantically, typed.**
  `checks.yaml`'s per-rule `parameters` is a generic `Record<string,
unknown>`; this session does not know each rule's exact parameter shape
  (e.g. that `availability.unavailable.v1` needs `spacedAttempts: number`)
  because rule implementations don't exist until Session 7. Session 7
  should add rule-specific parameter validation at that point.
- **Digest is exposed but not wired into any `AuditRun`.** No crawl/analyze
  pipeline exists yet (Session 4+) to actually construct an `AuditRun` and
  populate its `sourceRegistryDigest`/`crawlPolicyDigest`/
  `checkConfigDigest` fields with `computeConfigDigest`'s output — this
  session only proves the function itself is correct and deterministic.
- **`pnpm audit sources:validate` (as literally written in
  implementation.md §9.1) does not work** due to pnpm's built-in `audit`
  subcommand intercepting it first; use `pnpm run audit sources:validate`
  instead. See "Decisions" above. Flagged for whoever reviews this against
  the spec literally — this is a real tooling constraint, not an oversight.
- **No cross-check that `config/sources.assam.yaml` entries are reachable
  or genuinely official** — that requires network access and is explicitly
  out of scope for this session (and for Session 3's shape, arguably
  belongs to the ingestion/verification work of Session 17).

### Next session prerequisites (Session 3 — Inventory ingestion and normalization)

- `config/sources.assam.yaml` now has real (placeholder) source entries
  that validate; Session 3's `inventory:build` should read this file (via
  `packages/audit-cli/src/config/source-registry.ts`'s
  `sourceRegistryConfigSchema` and `loadYamlConfig`) and, for each enabled
  source, produce actual `InventorySource` records (`@panchnama/schema`)
  by stamping `retrievedAt` and `evidencePath` — the two fields this
  session's config schema deliberately omits.
- `config/crawl-policy.yaml` and `config/checks.yaml` exist and validate;
  Session 4's crawler and Session 7's rule engine should read them via
  `packages/audit-cli/src/config/crawl-policy.ts` /
  `packages/audit-cli/src/config/checks.ts` rather than hard-coding
  defaults.
- `computeConfigDigest` (`packages/audit-cli/src/config/digest.ts`) is
  ready to be called on the parsed config objects once a real `AuditRun`
  is constructed (Session 4+), to populate `sourceRegistryDigest` /
  `crawlPolicyDigest` / `checkConfigDigest`.
- `pnpm run audit sources:validate` (note: `run` is required, see
  "Decisions") is the validation entry point Session 3's `inventory:build`
  should likely call/reuse before ingesting, per §9.2's "invalid
  configuration prevents network activity."
- `config/portals/` remains empty of actual override files until Session 3
  creates `Portal` records with real IDs to override.

---

## Session 3 — Inventory ingestion and normalization

### Files changed

- `packages/audit-core/src/url-normalize.ts` (new) — pure URL normalization
  function implementing implementation.md section 6.5.
- `packages/audit-core/src/url-normalize.test.ts` (new) — 14 tests.
- `packages/audit-core/src/index.ts` — re-export `url-normalize.js`.
- `packages/audit-cli/package.json` — added `cheerio` (HTML parsing) and
  `@panchnama/audit-core` (workspace) dependencies.
- `packages/audit-cli/src/inventory/candidate.ts` (new) — the common
  intermediate `PortalCandidateReference`/`RejectedCandidate` shapes every
  adapter produces.
- `packages/audit-cli/src/inventory/csv.ts` (+ test) (new) — hand-rolled
  RFC 4180-style CSV parser (no new dependency for this session's simple
  fixture format).
- `packages/audit-cli/src/inventory/adapters/html.ts`, `json.ts`, `csv.ts`
  (+ tests) (new) — the three seed adapters.
- `packages/audit-cli/src/inventory/seed-inputs.ts` (new) — loads
  `data/seed/source-inputs.json` and `data/seed/aliases.json`.
- `packages/audit-cli/src/inventory/id.ts` (+ test) (new) — deterministic
  `Portal.id` and inventory-build `runId` derivation.
- `packages/audit-cli/src/inventory/merge.ts` (+ test) (new) — conservative
  dedup/merge into `Portal` records.
- `packages/audit-cli/src/inventory/build.ts` (+ test) (new) —
  `computeInventoryBuild`: orchestrates config loading, adapters,
  normalization, merge, and `InventorySource` record construction.
- `packages/audit-cli/src/inventory/report.ts` (new) — human-reviewable
  Markdown report generator.
- `packages/audit-cli/src/inventory/write.ts` (new) — atomic stage-then-move
  write of one inventory build's output, plus the `latest` pointer file.
- `packages/audit-cli/src/commands/inventory-build.ts`,
  `inventory-validate.ts` (+ tests) (new) — the two CLI commands.
- `packages/audit-cli/src/cli.ts` — extended the `runCli` switch with
  `inventory:build` and `inventory:validate`; added generic `--state`,
  `--seed-dir`, `--out-dir`, `--run-id` flag parsing alongside the existing
  `--config-dir`.
- `packages/audit-cli/src/index.ts` — re-export the new command/inventory
  modules for programmatic use.
- `data/seed/assam-directory-example.html`, `.json`, `.csv` (new) —
  illustrative, clearly-fictional seed fixtures (all domains use the
  reserved `.example` TLD) exercising all three adapters.
- `data/seed/source-inputs.json` (new) — Session 3's fixture-wiring map
  from `config/sources.assam.yaml` source IDs to a local seed file/format.
- `data/seed/aliases.json` (new) — one illustrative manually-reviewed URL
  alias mapping.
- `data/README.md` — documented `raw/inventory/` layout and `seed/`'s new
  contents.
- `docs/adding-sources.md` — added a short note on `source-inputs.json`
  and what `inventory:build` does/doesn't do yet.
- `docs/session-log.md` — this entry.

### Decisions

**Where URL normalization lives.** `packages/audit-core`, not
`packages/audit-cli`. It is a pure, deterministic, no-I/O function with no
dependency on any config schema — both this session's ingestion and the
future crawler (Session 4+, which normalizes links at crawl time) need the
exact same rules, and `audit-core` is documented (section 4.3) as the
home for "pure audit rules and classifiers" shared across the pipeline.
Its options shape (`UrlNormalizationOptions`) deliberately mirrors
`config/crawl-policy.yaml`'s `urlNormalization` block field-for-field so
callers pass the loaded config straight through without an adapter layer,
but `audit-core` itself has zero dependency on `audit-cli`'s config
schemas (no import cycle risk).

**Trailing-slash policy.** "strip": a trailing slash is removed from any
path longer than the bare root (`/foo/` → `/foo`), but the root path
always stays `/`. Matches `config/crawl-policy.yaml`'s committed default.

**http vs. https identity.** Deliberately conservative: normalization
lowercases the scheme but never treats `http:` and `https:` as
interchangeable for portal identity. Two candidates that differ only in
scheme remain two separate `Portal` records unless an explicit
`data/seed/aliases.json` entry says otherwise. Reasoning: section 6.5
lists specific normalization rules and does not list "merge http/https,"
and the section's explicit "do not merge URLs solely because their page
titles match" signals a general bias toward conservative, evidence-based
merging over inferred identity. A real crawler-observed redirect
(Session 4+) is the other sanctioned path to treat them as the same
portal, once redirect observations actually exist. Tested in
`url-normalize.test.ts` and `merge.test.ts`.

**Redirect-aware normalization: deferred, not fabricated.** No redirect
concept exists in the seed data format for this session. The crawler
(Session 4+) is what will observe real redirect chains; inventing a
"this URL redirects to that URL" field in seed JSON/CSV now would be
speculative and unfalsifiable. This is a scope decision, documented here
per the standard session prompt's "if implementation.md conflicts with
actual repository constraints, document the conflict."

**Seed-input wiring: separate `data/seed/source-inputs.json`, not a new
field on `config/sources.assam.yaml`.** Chose option (b) from the task's
two offered choices. Reasoning: `config/sources.assam.yaml` describes
_audit policy_ (which sources exist, are they enabled, what type are
they) — that's genuinely reusable once Session 17 does real research and
Session 4+'s crawler exists. "Which local seed fixture file exercises
this source before live crawling is authorized" is Session-3-specific
pre-flight wiring that has no meaning once real crawling starts; keeping
it in a separate, clearly-labeled seed file keeps Session 2's config
surface conceptually stable and avoids adding fields to a schema that
will need to be deprecated/removed later. `data/seed/source-inputs.json`
is loaded by `packages/audit-cli/src/inventory/seed-inputs.ts` with its
own small Zod schema; it is intentionally never read by
`sources:validate` (that stays Session-2-only).

**Dedup/merge policy.** Group candidates by canonical normalized URL
(after applying any manual alias substitution from `data/seed/aliases.json`).
Within a merged group:

- **Name (conflicting-label policy):** the name from the first-seen
  candidate whose source `sourceType` is `official_directory` or
  `official_page` wins; if no merged candidate came from such a source,
  the first-seen candidate's name wins regardless. Rationale: an
  officially-sourced label is more likely accurate than one from an
  unverified source, and "first seen" is the only deterministic
  tiebreak available when there's no official label at all. Tested in
  `merge.test.ts` ("prefers the name from an officially-sourced
  candidate…", "falls back to the first-seen name…"). Demonstrated live
  in the real build: "Transport Department" merges a JSON-sourced entry
  named "Transport Department (legacy RTO domain)" (from
  `official_directory` source `assam-online-services`, first in
  ingestion order) with a CSV-sourced entry named plain "Transport
  Department" (also `official_directory`, later in ingestion order) —
  the JSON name wins because it is first-seen among equally-official
  sources, which is the documented, deterministic behavior, not a bug.
- **`hostnames`:** the canonical URL's own hostname, plus every merged
  candidate's own (pre-alias) hostname. Two different hostnames only
  ever end up on the same `Portal` record when a documented alias
  connects them — `mergeCandidates` never infers a same-portal
  relationship from similarity alone (implementation.md section 6.5's
  "do not merge... solely because" principle, generalized).
- **`discovery`:** every merged candidate contributes a
  `{discoveredAt, discoveredFromUrl, discoveryMethod}` entry, deduped
  only on exact `(discoveredFromUrl, discoveryMethod)` pairs (which
  only collapses genuine re-observations of the same route within one
  build, never two different routes). Nothing is ever dropped or
  overwritten — this is the "no candidate loses its source provenance"
  exit criterion, mechanically enforced by `inventory:validate`'s
  "at least one discovery route" check.
- **`sourceRefs`:** union of every merged candidate's `sourceId`.
- **`department`/`portalType`/`tags`:** first non-empty value in
  insertion order for scalar fields; sorted-unique union for `tags`.

**Official-status default rule.** A candidate defaults to `verified` only
when its source's `sourceType` is `official_directory` or `official_page`
— `manual_verified` does _not_ auto-verify a candidate in this session's
automated path (narrower than "any configured source"). `manual_verified`
exists for `InventorySource` records produced by a human-confirmed
process this fixture-driven session doesn't perform; treating it as
auto-verifying here would blur "a human confirmed this" with "the config
file says this source category." `disputed` has no automated path
anywhere in this session — it is manual-review-only, per the task brief,
and nothing in `mergeCandidates` can produce it (tested: "never emits
'disputed' automatically").

**Malformed URL handling.** Every seed adapter (HTML/JSON/CSV) passes a
non-empty href/url field straight through as a candidate — adapters never
attempt URL validation themselves (single responsibility: extraction,
not normalization). All URL well-formedness/scheme checking happens once,
centrally, in `normalizeUrl`. A candidate that fails normalization is
never silently dropped or silently included: it is captured in
`candidates.json` and the human-readable `report.md`'s "Rejected /
malformed candidates" section with its reason, and excluded from
`portals.json`. Only HTML seed input is given a base URL for relative-URL
resolution (the source's configured `url`); JSON/CSV entries are
documented as already-absolute, so a malformed or accidentally-relative
value there is correctly flagged instead of "resolving" against the
source page (almost any string resolves successfully once _any_ base is
supplied, which would defeat malformed-URL detection for those formats).

**Output location and layout.** `data/raw/inventory/<runId>/`, where
`runId` is `assam-<UTC-timestamp>` (e.g. `assam-20260831T172849Z`),
containing `portals.json`, `sources.json`, `candidates.json` (every
candidate — merged, alternate, and rejected — with its original URL,
normalized URL, and which `Portal.id` it ended up in, for auditability),
and `report.md` (the human-reviewable summary). `data/raw/inventory/latest`
holds the current `runId` as plain text (not a symlink, for portability).
Chosen over `data/published/` because this output is explicitly
pre-review, fixture-driven, and not yet a validated/reviewed publication
dataset (that transformation is Session 8's job) — matches section 4.3's
description of `data/raw/` as "generated raw crawl data" and is already
git-ignored (`data/raw/*` in `.gitignore`, unchanged from Session 0/2).

**Atomicity and no-silent-overwrite.** `writeInventoryBuildAtomic` stages
every output file in a temp directory _inside_ `data/raw/inventory/`
(same filesystem, so the final `rename` is atomic) and only calls
`rename` into the final `<runId>/` path once every file is written; on
any failure the staging directory is removed and nothing partial is left
behind. If `<runId>/` already exists, the command refuses outright rather
than overwriting — this only happens if `inventory:build` runs twice
within the same UTC second, which is treated as a caller error per
section 9.2 ("never silently overwrite a completed run").

**Human-reviewable inventory output.** A generated Markdown report
(`report.md`) alongside the machine JSON: build summary, an inventory-
sources table, a portals table (name / official status / canonical URL /
sources / discovery routes), and a rejected-candidates table so a
reviewer can see what did _not_ make it in and why.

**CSV parsing: hand-rolled, no new dependency.** The seed CSV format is
simple (four columns, optional quoting) and adding a CSV library for it
felt like more surface area than the format warrants; `packages/audit-cli/src/inventory/csv.ts`
implements RFC 4180 quoting/escaping/CRLF handling as a small pure
function with its own unit tests. HTML parsing does use a new dependency
(`cheerio`), as explicitly instructed by the task brief and already
recommended in implementation.md section 4.1.

### Tests run and results

```
$ pnpm --filter @panchnama/audit-cli run test
 ✓ src/config/crawl-policy.test.ts (8 tests)
 ✓ src/config/source-registry.test.ts (12 tests)
 ✓ src/inventory/merge.test.ts (10 tests)
 ✓ src/inventory/adapters/html.test.ts (6 tests)
 ✓ src/config/validate.test.ts (7 tests)
 ✓ src/inventory/build.test.ts (4 tests)
 ✓ src/commands/inventory-validate.test.ts (6 tests)
 ✓ src/inventory/adapters/json.test.ts (6 tests)
 ✓ src/inventory/adapters/csv.test.ts (6 tests)
 ✓ src/inventory/csv.test.ts (7 tests)
 ✓ src/config/checks.test.ts (7 tests)
 ✓ src/config/digest.test.ts (6 tests)
 ✓ src/commands/inventory-build.test.ts (3 tests)
 ✓ src/inventory/id.test.ts (5 tests)
 ✓ src/config/portal-override.test.ts (5 tests)
 ✓ src/commands/sources-validate.test.ts (3 tests)
 ✓ src/index.test.ts (1 test)
 Test Files  17 passed (17) / Tests  102 passed (102)

$ pnpm --filter @panchnama/audit-core run test
 ✓ src/index.test.ts (1 test)
 ✓ src/url-normalize.test.ts (14 tests)
 Test Files  2 passed (2) / Tests  15 passed (15)

$ pnpm lint        # eslint . — exit 0, no output
$ pnpm typecheck   # 6 workspace projects, tsc --noEmit — exit 0
$ pnpm test        # all workspaces — 185 tests total — all passed
$ pnpm build       # apps/web (next build, 4/4 static pages) + 5 packages (tsc) — exit 0
$ pnpm format      # prettier — reformatted the new files to project style; no logic change
```

Manual `inventory:build` / `inventory:validate` verification (real
`config/sources.assam.yaml` + real `data/seed/*` fixtures, no network
activity):

```
$ pnpm run audit inventory:build --state assam
inventory:build PASSED
  runId: assam-20260831T172849Z
  portals: 7
  inventory sources: 3
  rejected/malformed candidates: 4
  output: /Users/.../Panchnama/data/raw/inventory/assam-20260831T172849Z
  report: /Users/.../Panchnama/data/raw/inventory/assam-20260831T172849Z/report.md

$ pnpm run audit inventory:validate --state assam
inventory:validate PASSED
  runId: assam-20260831T172849Z
  portals: 7
  inventory sources: 3
```

7 portals from 3 sources / 3 seed files, with the Agriculture Department
Portal and Transport Department portals each correctly merged across two
sources (dedup working), and the relative `/schemes/pension` link
correctly resolved against `https://assam.gov.in`. 4 candidates correctly
rejected (one malformed absolute URL, one non-http scheme, one malformed
CSV URL, one non-http scheme) and listed in `report.md` rather than
silently dropped.

Failure-case demonstration — `inventory:validate` against a deliberately
broken output directory (a portal with empty `sourceRefs`, a duplicate
`id`, and a `sourceRefs` entry that doesn't resolve to any loaded
`InventorySource`):

```
$ pnpm run audit inventory:validate --state assam
inventory:validate FAILED — 3 issue(s):
  - portal "broken-portal" (Broken Portal (missing sourceRefs)) has no sourceRefs — lost provenance
  - duplicate Portal id: "broken-portal"
  - portal "broken-portal" (Duplicate Id Portal) references sourceRef "nonexistent-source", which does not resolve to any loaded InventorySource
(exit code 1)
```

No network activity occurred at any point in this session (verified: no
`fetch`/HTTP client import anywhere under `packages/audit-cli/src/inventory/`
or `packages/audit-core/src/`).

### Known limitations (deferred checks, explicit)

- **All ingested content is illustrative fixture data.** Every seed file
  under `data/seed/` (`assam-directory-example.{html,json,csv}`,
  `aliases.json`) is hand-authored, uses the reserved `.example` TLD, and
  is explicitly documented in-file as not a real scraped government page.
  Real seed content sourcing and verification happens in Session 17.
- **Redirect-aware normalization deferred to Session 4+.** No redirect
  concept exists in this session's seed format or normalization function;
  the crawler is what will observe real redirect chains.
- **`disputed` officialStatus is manual-only.** No code path in this
  session (or any session so far) can produce it; it exists in the schema
  for a future human-review workflow.
- **`data/seed/source-inputs.json` mapping is 1:1 with the current 3
  sources.** Adding a 4th source to `config/sources.assam.yaml` without a
  matching `source-inputs.json` entry produces a build-time _warning_
  (not a failure) and simply contributes no candidates from that source —
  documented in `docs/adding-sources.md`.
- **No cross-check against `config/portals/*.yaml` overrides.** Session 2
  validates override file _shape_ only (no real `Portal` ids existed
  yet); now that real `Portal` records exist, a future session could add
  a check that any override's `portalId` resolves to an actual built
  portal. Out of scope here — this session's `inventory:validate` checks
  only the invariants the task brief specifies (discovery routes,
  sourceRefs, duplicate ids, sourceRef resolution).
- **`Portal.id` derivation is a URL-slug heuristic**
  (`packages/audit-cli/src/inventory/id.ts`), not a registry-assigned ID.
  Deterministic and URL-safe, but if a portal's canonical URL later
  changes (e.g. a real redirect/migration observed in Session 4+), its
  derived ID changes too — there is no persistent identity layer across
  builds yet. This is acceptable for a pre-review fixture-driven build;
  Session 8's publication pipeline is a more natural place to introduce
  stable cross-run portal identity if needed.
- **`inventory:build`'s per-run output directories accumulate** under
  `data/raw/inventory/` (each run keeps its own timestamped directory,
  by design, to avoid silently overwriting). Nothing in this session
  prunes old runs; `data/raw/` is git-ignored so this doesn't affect the
  repository, but a long-lived local checkout will accumulate directories
  over time. Left for a later session (or manual cleanup) to address if
  it becomes a problem.

### Next session prerequisites (Session 4 — Safe fetcher and crawl frontier)

- `data/raw/inventory/<runId>/portals.json` now contains real (fixture-
  derived) `Portal` records with `id`, `canonicalUrl`, `hostnames`, and
  `crawlProfile` (currently always absent/default) — Session 4's crawl
  frontier should read the latest inventory build's portals as its crawl
  target list, most likely via `readLatestRunId` +
  `packages/audit-cli/src/inventory/write.ts`'s output convention rather
  than re-deriving it.
- `@panchnama/audit-core`'s `normalizeUrl` (with
  `UrlNormalizationOptions` sourced from `config/crawl-policy.yaml`'s
  `urlNormalization` block, already loaded by
  `packages/audit-cli/src/config/crawl-policy.ts`) is ready for the
  crawler to reuse for link normalization during crawling — do not
  reimplement normalization in the crawler.
- The http/https-identity and redirect-deferral decisions above are
  exactly the ones Session 4+ needs to revisit once real redirect chains
  exist: a redirect observation is the documented, sanctioned way to
  treat an http/https pair (or two different hosts) as the same portal,
  the same way `data/seed/aliases.json` does manually today.
- `config/crawl-policy.yaml`'s `boundaries`, `exclusions`,
  `robotsAndIdentification`, `jsRendering`, and `safeOperation` blocks
  (loaded, typed, and validated since Session 2) are all still
  unconsumed by any actual fetcher — Session 4 is where they get used for
  real.
