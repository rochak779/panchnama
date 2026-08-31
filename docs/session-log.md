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
