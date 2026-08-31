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

---

## Session 4 — Safe fetcher and crawl frontier

**Date:** 2026-08-31
**Goal:** Build the bounded, polite HTTP acquisition layer (implementation.md
section 14, "Session 4").

### Files changed

- `packages/audit-core/src/crawl-errors.ts` (+ test) — pure classification
  of Node/fetch errors and HTTP statuses into the section 9.3 stable error
  taxonomy.
- `packages/audit-core/src/ip-range.ts` (+ test) — pure IPv4/IPv6
  loopback/link-local/private/metadata-range check for SSRF (section 12.1).
- `packages/audit-core/src/crawl-scope.ts` (+ test) — pure hostname-scope,
  disabled-domain, denylist-pattern, and route-category decisions (sections
  6.1/6.2).
- `packages/audit-core/src/robots-txt.ts` (+ test) — minimal hand-rolled
  robots.txt parser/matcher (section 6.3).
- `packages/audit-core/src/link-scan.ts` (+ test) — minimal regex `<a href>`
  extractor (the Session 4/5 boundary; see below).
- `packages/audit-core/src/index.ts` — re-exports the above.
- `packages/audit-cli/src/crawl/ssrf.ts` (+ test) — DNS-resolve-then-check
  SSRF guard, with a documented test-only bypass.
- `packages/audit-cli/src/crawl/http-fetcher.ts` (+ test) — the bounded
  fetcher: timeout (two-phase connect/read), response-size streaming limit,
  manual redirect-chain capture, retry/backoff, GET/HEAD-only, no cookie
  jar.
- `packages/audit-cli/src/crawl/host-scheduler.ts` (+ test) — per-host
  concurrency + minimum-delay queue.
- `packages/audit-cli/src/crawl/robots-fetcher.ts` — per-host robots.txt
  fetch + cache, using the audit-core parser.
- `packages/audit-cli/src/crawl/frontier.ts` (+ test) — BFS crawl frontier:
  scope/exclusion/robots/kill-switch enforcement, page-observation
  generation, minimal link discovery, depth/page-budget boundaries.
- `packages/audit-cli/src/crawl/manifest.ts` — `AuditRun` manifest builder
  (config digests, git revision, node version, enabled checks).
- `packages/audit-cli/src/crawl/id.ts` — `assam-<date>-r<n>` run-id
  derivation.
- `packages/audit-cli/src/crawl/write.ts` — atomic write for
  `data/raw/crawl/<runId>/` (mirrors Session 3's inventory-write
  convention).
- `packages/audit-cli/src/crawl/run.ts` — full run orchestration: config
  loading, kill-switch check, inventory loading, per-portal isolation,
  manifest assembly, atomic write.
- `packages/audit-cli/src/crawl/testing/fixture-server.ts` — local
  `node:http` fixture server helper shared by every crawler test.
- `packages/audit-cli/src/commands/crawl.ts` (+ test) — CLI command
  wrapper.
- `packages/audit-cli/src/cli.ts` — adds the `crawl` case to the dispatcher
  switch; `runCli` is now `async` (required once a command performs
  network I/O).
- `packages/audit-cli/src/bin.ts` — `await`s the now-async `runCli`.

### Decisions

**audit-core / audit-cli split.** Followed Session 3's precedent exactly:
everything that is a pure function over already-known inputs (error
classification, IP-range checks, scope decisions, robots.txt parsing,
`<a href>` extraction) lives in `audit-core` with no I/O and no
dependencies. Everything that performs a network call, spawns a timer,
touches the filesystem, or reads process/config state (the fetcher, the
SSRF DNS lookup, the host scheduler, the robots.txt _fetch_, the frontier
orchestration, the CLI command) lives in `audit-cli`. This split is what
let every `audit-core` addition be tested with zero network/timers and
every `audit-cli` addition be tested against real local fixture servers.

**Session 4/5 link-discovery boundary.** `audit-core/src/link-scan.ts`
(`extractRawHrefs`) is a regex-based `<a href="...">` scanner — it does
_not_ parse title, canonical URL, language, anchor text, or link context.
It exists solely so the frontier has candidate URLs to normalize and
enqueue while walking depth 0..maxDepth. Session 5 ("HTML extraction and
link checking") replaces the _use_ of this function inside the frontier
with real Cheerio-based extraction and adds the fields this session leaves
empty (`title`, `canonical`, `language` on `PageObservation`) plus
destination `LinkObservation` link-checking, which this session does not
build at all — the frontier only records which pages _it_ visited, not
whether the links on those pages resolve.

**Redirect-chain capture.** The fetcher uses `fetch(..., { redirect:
"manual" })` and follows each hop itself, rather than letting `fetch`
auto-follow, for two reasons: (1) `PageObservation.redirectChain` needs
every intermediate URL and status, which an auto-following `fetch` never
exposes; (2) each hop is independently re-checked for scheme and SSRF
before being followed, since a redirect can point anywhere (including a
private IP) and the original URL's SSRF check says nothing about where a
redirect leads.

**Two-phase timeout.** `requestTimeoutMs` is spent twice: once waiting for
response headers (an abort here → `CONNECT_TIMEOUT`) and again, restarted,
while streaming the body (an abort here → `READ_TIMEOUT`). Both phases
share one `AbortController`, so a body-read timeout actually tears down the
in-flight socket read rather than merely abandoning a dangling promise.

**Response-size limit.** Enforced by streaming: `readBodyBounded` reads
chunks via the body's `ReadableStreamDefaultReader`, counts bytes as they
arrive, and calls `controller.abort()` the moment the running total
exceeds `maxResponseBodyBytes` — the response is never buffered in full
before the check runs. The fetcher always decodes the (bounded) body as
UTF-8 text regardless of content type (an earlier draft only decoded
`text/html`, which broke robots.txt's `text/plain` body — fixed and
covered by `robots-txt` fixture tests); content-type-based "is this a
crawlable HTML page" filtering happens one layer up, in the frontier.

**Retry/backoff.** `fetchWithRetry` retries only
`DNS_FAILURE`/`CONNECT_TIMEOUT`/`READ_TIMEOUT`/`HTTP_SERVER_ERROR` (never
4xx, TLS errors, `TOO_MANY_REDIRECTS`, or SSRF/scope rejections — retrying
those wastes requests without a plausible chance of success), up to
`crawlPolicy.boundaries.maxAttemptsAvailabilityCritical`, with exponential
backoff + jitter. Applied uniformly to every page fetch in this session
(not restricted to just each portal's entry URL) — a deliberate
simplification over the spec's narrower "availability-critical requests"
phrasing, documented here rather than building a second, unretried fetch
path this session doesn't need.

**Error-code mapping fidelity vs. section 9.3's 15 codes** (see also "Risks
below):

- Fully implemented and exercised by local-server tests: `DNS_FAILURE`,
  `CONNECT_TIMEOUT` (incl. `ECONNREFUSED`, `ECONNRESET`, unreachable-host
  codes — the taxonomy has no separate "connection refused" code, so this
  is a documented convention), `READ_TIMEOUT`, `TOO_MANY_REDIRECTS`,
  `HTTP_CLIENT_ERROR`, `HTTP_SERVER_ERROR`, `AUTH_REQUIRED` (401),
  `ROBOTS_DISALLOWED`, `RESPONSE_TOO_LARGE`.
- Classification logic is faithful to Node's real TLS error codes
  (`CERT_HAS_EXPIRED` → `TLS_CERT_EXPIRED`,
  `ERR_TLS_CERT_ALTNAME_INVALID`/`HOSTNAME_MISMATCH` →
  `TLS_HOST_MISMATCH`) but **not exercised against a real local
  self-signed/expired-cert HTTPS fixture** this session — standing up a
  cert with a genuinely expired `notAfter` and getting Node to actually
  reach the TLS-verification failure path (vs. `ERR_TLS_CERT_ALTNAME_INVALID`
  short-circuiting first) reliably in CI was judged not worth the added
  fixture complexity for this session; unit-tested only via constructed
  error objects (`crawl-errors.test.ts`).
- **Not implemented, structurally deferred:** `AUTOMATION_BLOCKED` and
  `PARSER_FAILURE` require content-level analysis (bot-block/CAPTCHA page
  detection, HTML parsing failures) that doesn't exist until Session 6/7 —
  no code path in this session can produce them, by design. `UNSUPPORTED_CONTENT`
  exists in the taxonomy constant but nothing in the frontier emits it yet
  (non-HTML responses are recorded normally, just not crawled into — not
  treated as an error at this layer, per the task brief's "don't invent
  detection you can't perform").
- `SCOPE_EXCLUDED` and `SSRF_BLOCKED` are two codes _added_ to the taxonomy
  constant beyond section 9.3's literal list, for the fetcher's own
  defense-in-depth scheme/SSRF checks (the frontier's scope check happens
  first and normally prevents these from firing in practice, but the
  fetcher re-checks independently rather than trusting a caller).

**SSRF test-bypass mechanism.** `checkSsrf(hostname, { allowLoopbackForTests
})` — an explicit, named, documented-as-test-only option threaded from
`HttpFetcherOptions.ssrf` down through the frontier and `runCrawl`. The
production `crawl` CLI command (`packages/audit-cli/src/commands/crawl.ts`
→ `cli.ts`'s `crawl` case) never sets it — grep for
`allowLoopbackForTests` confirms every call site is either test code or the
option's own pass-through plumbing. Demonstrated live (see below): the real
CLI, pointed at a loopback fixture with no override, correctly produces an
`SSRF_BLOCKED` `PageObservation` rather than connecting.

**Output location and layout.** `data/raw/crawl/<runId>/`, containing
`manifest.json` (the `AuditRun`), `page-observations.jsonl` (JSONL, not a
single JSON array, so a very large run can be streamed/appended without an
in-memory array and a truncated file is self-evidently partial), and
`skip-log.json` (every scope-excluded / robots-disallowed / budget-cut URL
with its reason, for coverage reporting). `data/raw/crawl/latest` holds the
current `runId` as plain text, mirroring Session 3's inventory convention
exactly. Never overwrites an existing `<runId>/` directory (refuses with a
clear message instead), matching Session 3's precedent.

**Resumability — narrower than "fully resumable."** This session's `crawl`
command performs one atomic write at the very end of a run (stage in a
temp dir, validate every record against its schema, `rename` into place);
it does **not** persist intermediate state while a run is in progress, so
an interrupted run cannot be resumed mid-flight — it must be re-run under
a new `--run-id`. This is a deliberate, documented narrowing of section
9.2's "resumable and idempotent where practical": true mid-run resumability
would need a durable frontier/visited-set on disk, which felt like
overbuilding for a session whose exit criteria are about boundaries and
isolation, not resumability depth. Idempotency is achieved via
never-overwrite + deterministic auto-incrementing run ids
(`assam-<date>-r<n>`), not via resuming.

**Kill switch / disabled domains.** `crawlPolicy.safeOperation.globalKillSwitch`
is checked once, first, before any config-dependent work (including
`--dry-run` planning) — the whole command refuses. `disabledDomains` is
enforced per-URL inside `decideScope` (audit-core), so it applies uniformly
to a portal's entry URL and every discovered URL; a portal whose entry
hostname is disabled ends up with zero fetched pages and `status: "failed"`
(via the "entry never succeeded" derivation), with the skip reason recorded
in `skip-log.json`.

**Portal status derivation.** `succeeded` = the first-processed seed URL
was fetched successfully and no page in the crawl had an `errorCode`;
`partial` = the entry succeeded but at least one other page errored (robots
-disallowed pages do _not_ count as errors — reduced coverage, not
failure, per section 6.3); `failed` = the entry itself never succeeded
(fetch error, or scope/kill-switch exclusion). The run-level `AuditRun.status`
is then derived from portal counts per the schema's existing invariant
(`completed` iff all succeeded, `failed` iff none did, `partial` otherwise).

### Tests run and results

```
$ pnpm lint         # eslint . — exit 0, no output
$ pnpm typecheck    # 6 workspace projects — exit 0
$ pnpm test         # all workspaces — 261 tests total — all passed
$ pnpm build        # apps/web (next build) + 5 packages (tsc) — exit 0
$ pnpm format       # prettier — reformatted new files to project style
```

New test files and counts:

- `packages/audit-core`: `crawl-errors.test.ts` (11), `ip-range.test.ts` (8),
  `crawl-scope.test.ts` (8), `robots-txt.test.ts` (7), `link-scan.test.ts`
  (6) — 40 new tests, all against constructed inputs, no I/O.
- `packages/audit-cli`: `crawl/http-fetcher.test.ts` (15 — status codes,
  single/multi-hop redirects, redirect-loop termination at `maxRedirects`,
  connect timeout, read timeout, oversized-body streaming abort, connection
  refused, GET/HEAD-only, retry recovery/non-retry/exhaustion),
  `crawl/ssrf.test.ts` (7), `crawl/host-scheduler.test.ts` (3),
  `crawl/frontier.test.ts` (6 — depth boundary, page-budget boundary,
  robots homepage-allowed/deeper-disallowed, out-of-scope hostname, dry-run
  zero-requests, entry-failure isolation), `commands/crawl.test.ts` (6 —
  multi-portal run with one unreachable portal isolated, kill-switch
  refusal, disabled-domain skip, dry-run zero-requests-and-zero-disk-writes,
  never-overwrite, config-digest consistency with `computeConfigDigest`).
  All against local `node:http` fixture servers (via the shared
  `crawl/testing/fixture-server.ts` helper) — zero live-network calls
  anywhere in the suite.

### Manual verification (real CLI, real inventory, no live-internet targets)

Real inventory build, then real CLI `--dry-run` against the real
(fixture-derived) Assam inventory — genuinely zero network calls, verified
by the absence of any output directory:

```
$ pnpm run audit inventory:build --state assam
inventory:build PASSED
  runId: assam-20260831T175228Z
  portals: 7
  ...

$ pnpm run audit crawl --state assam --dry-run --out-dir /tmp/panchnama-demo/crawl
crawl run: assam-2026-08-31-r1
inventory: assam-20260831T175228Z
portals: 7
mode: --dry-run (no network requests will be made)
  [succeeded] agriculture.assam.gov.example — 1 page(s) (planned: 1)
  [succeeded] health.assam.gov.example — 1 page(s) (planned: 1)
  [succeeded] online.assam.gov.example — 1 page(s) (planned: 1)
  [succeeded] assam.gov.in-schemes-pension — 1 page(s) (planned: 1)
  [succeeded] transport.assam.gov.example — 2 page(s) (planned: 2)
  [succeeded] kamrup.assam.gov.example — 1 page(s) (planned: 1)
  [succeeded] dibrugarh.assam.gov.example — 1 page(s) (planned: 1)
# (no /tmp/panchnama-demo/crawl directory was created)
```

Kill-switch refusal (copied config with `globalKillSwitch: true`):

```
$ pnpm run audit crawl --state assam --config-dir <copy-with-kill-switch-on>
crawl FAILED
crawl REFUSED — crawlPolicy.safeOperation.globalKillSwitch is true.
  No requests were made. Set globalKillSwitch: false in config/crawl-policy.yaml to re-enable crawling.
(exit code 1; no output directory created)
```

SSRF guard firing on the real, unmodified CLI path (a local fixture server
on `127.0.0.1`, no test-only override — this is the _expected and correct_
outcome, proving the production path cannot be pointed at loopback):

```
$ pnpm run audit crawl --portal demo-fixture-portal --inventory-out-dir <fixture-inventory> --out-dir <out>
crawl run: demo-real-r1
  [failed] demo-fixture-portal — 1 page(s)
status: failed
# page-observations.jsonl:
{"errorCode":"SSRF_BLOCKED","errorMessage":"hostname \"127.0.0.1\" resolves to blocked address 127.0.0.1 (loopback/link-local/private/metadata range)", ...}
```

A successful scoped crawl against the same local fixture, run through a
small ad hoc script that calls `runCrawl()` directly with the documented
test-only `ssrf.allowLoopbackForTests` override (never the real CLI path —
this is exactly how the automated test suite exercises the fetcher, just
demonstrated interactively):

```
crawl run: demo-harness-r1
inventory: demo-fixture-run
portals: 1
  [succeeded] demo-fixture-portal — 2 page(s)
status: completed
portals succeeded/partial/failed: 1/0/0
page observations: 2
output: /tmp/panchnama-demo/crawl-harness/demo-harness-r1
```

Resulting `manifest.json` validated against `auditRunSchema` inline by the
command itself before writing; both `page-observations.jsonl` records
validated against `pageObservationSchema` (homepage `httpStatus: 200`, and
the discovered `/about` link fetched at depth 1 with `discoveredFrom` set
to the homepage URL — demonstrating the minimal link-discovery frontier
end to end).

### Known limitations (deferred/best-effort, explicit)

- **TLS error codes (`TLS_CERT_EXPIRED`, `TLS_HOST_MISMATCH`) are
  classification-correct but not exercised against a real expired/mismatched
  local HTTPS fixture** — see "Error-code mapping fidelity" above. Best-effort:
  unit-tested via constructed error objects matching Node's actual error
  shapes, not via a live handshake failure.
- **`AUTOMATION_BLOCKED` and `PARSER_FAILURE` are not implemented at all**
  this session — both require content-level analysis that doesn't exist
  until Session 6 (browser fallback / block detection) and Session 7
  (rules that interpret parsing outcomes). No code path emits them.
- **`UNSUPPORTED_CONTENT` is declared but unused.** Non-HTML responses are
  recorded as ordinary successful `PageObservation`s (with their real
  `contentType`) and simply excluded from link discovery — not flagged as
  an error, since nothing about "this is a PDF" is itself a failure.
- **Retry policy is applied uniformly to every page fetch**, not narrowed
  to just each portal's designated "entry URL" as section 7.1's literal
  phrasing might suggest — see "Retry/backoff" decision above.
- **No true mid-run resumability** — see "Resumability" decision above.
  An interrupted run is not resumed; a fresh run (new `--run-id`) is
  required.
- **`packageVersionsDigest` approximates "digest of the resolved lockfile"**
  (section 5.4) with `{ node: process.version, audit_cli_version: "0.0.0" }`
  rather than actually parsing `pnpm-lock.yaml` — the workspace has no
  lockfile-hashing utility yet, and pinning exact dependency versions
  wasn't judged worth a new dependency-parsing step this session. Flagged
  in `manifest.ts` with a comment pointing at this limitation.
- **`methodologyVersion` is a fixed placeholder (`"0.1.0"`)** — no real,
  versioned methodology document exists yet (implementation.md section
  10.7 is a later session).
- **Route-category exclusion matching (`ROUTE_CATEGORY_PATTERNS` in
  `crawl-scope.ts`) is a best-effort heuristic** (path-substring regexes
  for login/logout/payment/calendar/site-search/etc.), not a guarantee —
  documented in-file as approximating section 6.2's route categories from
  URL shape alone, since the more reliable signal (page content, form
  presence) doesn't exist until later sessions. "Forms that mutate server
  state" specifically is not detectable at this layer at all and is instead
  structurally prevented by the fetcher only ever issuing GET/HEAD.
- **No evidence-artifact capture this session.** Every `PageObservation.artifactRefs`
  is `[]`; no `EvidenceArtifact` records are produced. `bodyDigest` (a
  SHA-256 of the fetched body) is populated for free as a lightweight
  integrity signal, but no snapshot is persisted to `data/evidence/` —
  that's implicitly Session 7/8 territory (materializing typed evidence
  records), out of scope for "build the fetcher."

### Next session prerequisites (Session 5 — HTML extraction and link checking)

- `packages/audit-cli/src/crawl/frontier.ts`'s use of `extractRawHrefs`
  (from `@panchnama/audit-core`) is exactly what Session 5 replaces with
  full Cheerio-based extraction (title, canonical, language, anchor text,
  link context) — the minimal scanner stays in `audit-core` as a
  documented, superseded-in-practice building block; nothing needs to be
  deleted, just no longer called from the frontier once Session 5 lands.
- `PageObservation.title` / `.canonical` / `.language` are always absent
  from every record this session produces — Session 5 is where they get
  populated.
- No `LinkObservation` records exist yet at all — Session 5 introduces
  destination link-checking (GET/HEAD-with-fallback on discovered
  destinations, deduplicated by normalized URL, grouped failures) as a new
  pipeline stage consuming this session's `PageObservation`s.
- `packages/audit-cli/src/crawl/http-fetcher.ts`'s `fetchOnce`/`fetchWithRetry`
  and `packages/audit-cli/src/crawl/host-scheduler.ts`'s `HostScheduler`
  are both directly reusable for link-checking — Session 5 should not
  reimplement bounded fetching, just call these against discovered
  destination URLs.
- `HttpFetcherOptions.method` already supports `"HEAD"` for the
  "GET/HEAD fallback behavior" section 14 Session 5 calls for.
- `config/crawl-policy.yaml`'s `jsRendering` block is still read only for
  shape (via Session 2's config loader) and not acted on anywhere — Session
  6 is where `browserFallbackEnabled`/`perPortalAllowlist` actually change
  fetcher behavior. `PageObservation.fetchMode` is hard-coded to `"http"`
  everywhere in this session, exactly as instructed (leaving the field/hook
  for Session 6 to populate `"browser"`).

---

## Session 5 — HTML extraction and link checking

**Date:** 2026-08-31
**Goal:** Turn fetched pages into normalized page and link observations
(implementation.md section 14, "Session 5").

### Files changed

- `packages/audit-cli/src/crawl/html-extract.ts` (new) — Cheerio-based
  full HTML extraction: title, canonical, language, base-tag-aware link
  resolution, anchor text, bounded link context.
- `packages/audit-cli/src/crawl/html-extract.test.ts` (new).
- `packages/audit-cli/src/crawl/link-check.ts` (new) — destination link
  checking: exclusion classification, network-layer dedup, HEAD/GET
  fallback, retry reuse.
- `packages/audit-cli/src/crawl/link-check.test.ts` (new).
- `packages/audit-cli/src/crawl/frontier.ts` — replaced `extractRawHrefs`
  with `html-extract.ts`'s extractor for both queue expansion and
  `PageObservation.title`/`.canonical`/`.language` population; added
  `LinkOccurrence` collection.
- `packages/audit-cli/src/crawl/frontier.test.ts` — unchanged behavior,
  still passes (extraction change is additive).
- `packages/audit-cli/src/crawl/run.ts` — wires `checkPortalLinks` into
  each portal's crawl (non-dry-run only), validates and writes
  `LinkObservation`s; fixed a pre-existing `AuditRun.status` derivation
  bug (see Decisions).
- `packages/audit-cli/src/crawl/write.ts` — writes
  `link-observations.jsonl` alongside `page-observations.jsonl`.
- `packages/audit-cli/src/commands/crawl.test.ts` — added an end-to-end
  test covering extraction + broken internal/external links + excluded
  mailto link, all schema-validated.
- `packages/audit-core/src/link-scan.ts` — untouched; no longer referenced
  by the frontier (see Decisions).

### Decisions

- **`link-scan.ts`'s role**: left in `audit-core`, unmodified, but no
  longer called anywhere. The frontier now uses `html-extract.ts`'s
  Cheerio-based extractor for both queue expansion and title/canonical/
  language population — judged that correctness (base-tag resolution,
  entity decoding, real DOM semantics) outweighs the earlier regex
  shortcut, and that doing extraction once per fetched page (rather than
  once for frontier-walking and again for link-checking) avoids two
  silently-diverging notions of "what a link on this page is." No
  audit-core code was deleted since it's still a documented, dependency-
  free building block per the task brief's instruction not to delete
  things without cause.
- **Dedup layer**: deduplication happens at the network-request layer, not
  the record layer. Every discovered link occurrence (one per source page
  - anchor) becomes its own `LinkObservation` — full traceability, matching
    section 5.6's one-`sourcePageUrl`-per-record schema literally — but the
    actual HEAD/GET check for a given `normalizedDestinationUrl` runs exactly
    once per portal crawl, and its result (`checkedAt`/`status`/`httpStatus`/
    `errorCode`/`attempts`) is copied across every occurrence. "Group
    identical failed destinations" (section 7.2) falls out of this for free:
    group `link-observations.jsonl` by `normalizedDestinationUrl`.
- **HEAD/GET fallback heuristic**: HEAD is tried first. It is treated as a
  _false_ failure — worth retrying as GET — only when the server actually
  responded with HTTP 405 or 501 (the two standard "this endpoint doesn't
  support HEAD" signals). Any other outcome (success, other 4xx/5xx,
  network/timeout failure) is trusted as-is with no GET fallback. Verified
  against a fixture server returning 405-for-HEAD/200-for-GET. Known
  limitation: a server that fails HEAD in some other, non-405/501 way (or
  passes HEAD but genuinely fails GET) is not covered by this heuristic.
- **Output file naming/location**: `link-observations.jsonl` written next
  to `page-observations.jsonl` in `data/raw/crawl/<runId>/`, same
  one-JSON-object-per-line convention, same atomic-write path.
- **CLI wiring**: no new flag. Link checking is always-on as part of
  `crawl` whenever the run is not `--dry-run` and a portal's frontier
  discovered at least one link — matching how page-fetching itself has no
  opt-out flag. `--dry-run` still makes zero network requests of any kind
  (frontier planning only; `checkPortalLinks` is never invoked).
- **Exclusion classification reuse**: link-check exclusion (mail/tel/js/
  data schemes, denylisted paths, excluded route categories, disabled
  domains) reuses `@panchnama/audit-core`'s `decideScope` by passing
  `portalHostnames: [hostname]` — a deliberate trick that makes the
  hostname-scope half of `decideScope` always pass (link checking must
  check both internal and external destinations, unlike frontier
  queueing) while still reusing its exclusion-pattern logic. Excluded
  links get `status: "not_applicable"`, `errorCode: "SCOPE_EXCLUDED"`
  (reusing the same stable code the frontier already uses for the
  analogous scope decision), `attempts: 0`, and never touch the network.
- **"Context" definition**: the trimmed, whitespace-collapsed text of the
  anchor's immediate parent element, truncated to 200 characters. Cheap,
  bounded, gives a human enough surrounding text to place the link on the
  page without storing unbounded content. Anchor text is truncated to the
  same 200-character bound.
- **Bug fix (pre-existing, Session 4)**: `run.ts`'s `AuditRun.status`
  derivation compared `failed === portals.length` where the schema's own
  invariant (`packages/schema/src/audit-run.ts`) actually requires
  `succeeded === 0` for a "failed" run-level status. This mismatch was
  latent because no prior test exercised a single-portal run whose only
  portal came back portal-level `"partial"` (possible since Session 4, but
  first actually triggered by this session's link-page fixture, whose
  frontier itself discovers a broken internal page). Fixed to derive
  status the same way the schema checks it: `completed` iff all succeeded,
  `failed` iff none succeeded, `partial` otherwise.

### Tests run and results

```
pnpm lint        — pass (0 errors)
pnpm typecheck   — pass (6/6 packages)
pnpm test        — pass (279 tests across all packages;
                    audit-cli: 24 files / 156 tests, incl. 9 new
                    html-extract tests, 7 new link-check tests, and 1 new
                    end-to-end crawl.test.ts case)
pnpm build       — pass (6/6 packages + Next.js app)
```

### Manual verification (local fixture portal, no live-internet targets)

Ran `runCrawl()` directly (test-only `ssrf.allowLoopbackForTests` override,
same pattern as Session 4's manual verification — never the real CLI path)
against a local fixture HTTP server with a home page (title/canonical/
language present), a working internal link, a broken internal link (404),
an excluded `mailto:` link, and a broken external link (connection
refused):

```
crawl run: demo-harness-r1
inventory: demo-inventory-r1
portals: 1
  [partial] demo-fixture-portal — 3 page(s)
status: failed
portals succeeded/partial/failed: 0/1/0
page observations: 3
link observations: 4
output: /tmp/panchnama-demo5/work/crawl/demo-harness-r1
```

`page-observations.jsonl` (home page, extraction fields present):

```json
{"id":"demo-harness-r1-demo-fixture-portal-p1", ..., "title":"Assam Test Portal — Home","canonical":"http://127.0.0.1:54162/","language":"en", ...}
```

`link-observations.jsonl` (all four discovered links, correctly checked
and classified):

```json
{"...-l1", "destinationUrl":"http://127.0.0.1:54162/scheme-details", "relationship":"internal", "status":"pass","httpStatus":200,"attempts":1}
{"...-l2", "destinationUrl":"http://127.0.0.1:54162/broken-pdf-link", "relationship":"internal", "status":"fail","httpStatus":404,"errorCode":"HTTP_CLIENT_ERROR","attempts":1}
{"...-l3", "destinationUrl":"mailto:help@assam.gov.example", "relationship":"external", "status":"not_applicable","errorCode":"SCOPE_EXCLUDED","attempts":0}
{"...-l4", "destinationUrl":"http://localhost:59999/", "relationship":"external", "status":"fail","errorCode":"CONNECT_TIMEOUT","attempts":2}
```

All records validated against `pageObservationSchema`/`linkObservationSchema`
by the command itself before writing.

### Known limitations (deferred/best-effort, explicit)

- **HEAD/GET fallback heuristic** only treats HTTP 405/501 as a "false"
  HEAD failure — a server that fails HEAD some other way, or that passes
  HEAD but fails GET, is not covered.
- **Non-HTML link destinations are checked but never parsed** — this is
  correct per section 6.2 ("directly linked documents may be recorded"
  but not recursively crawled), but means a GET check on a large non-HTML
  file still reads its full (bounded) body even though the content is
  discarded; no `HEAD`-only short-circuit for known non-HTML extensions
  was built this session.
- **Link checking is per-portal, not globally deduplicated across
  portals** — two different portals linking to the same external URL will
  each trigger their own check. This matches the section 7.2 dedup
  requirement read at portal-crawl scope and keeps each portal's crawl
  self-contained/isolatable (matching Session 4's per-portal try/catch
  isolation); cross-portal dedup was judged out of scope and is a natural
  Session 7/8 rollup concern instead (aggregating already-produced
  `LinkObservation`s).
- **`CheckStatus` values `"warning"` and `"not_assessable"` are never
  emitted by link checking this session** — only `"pass"`, `"fail"`, and
  `"not_applicable"` are used; assigning severity/warning-vs-fail nuance
  is Session 7's job.
- **No evidence-artifact capture** — same as Session 4; `artifactRefs`
  stays `[]` on every `PageObservation`, and link checks produce no
  `EvidenceArtifact` records.
- **Internal links discovered by the frontier may be fetched twice** — once
  as a page (frontier walk, if in scope/within depth) and again as a link
  check destination (always, if not excluded). This is a deliberate
  simplification (link-checking is a fully separate, general-purpose pass
  over every discovered link, not just frontier-followed ones) rather than
  an attempt to reuse frontier fetch results for link-check output, and is
  bounded by the same per-host politeness/concurrency scheduler either way.
- **Bug fix note**: the `AuditRun.status` derivation fix (see Decisions)
  changes prior behavior for the specific case of a single-portal run whose
  only portal comes back "partial" — it now reports run-level `"failed"`
  instead of the previously schema-invalid `"partial"`, matching the
  schema's own literal definition. No existing test asserted the old
  (buggy) behavior, so nothing outside this session's new tests depended
  on it.

### Next session prerequisites (Session 6 — Browser fallback)

- `PageObservation.fetchMode` is still hard-coded to `"http"` everywhere;
  Session 6 introduces `"browser"` for allowlisted JS-rendered portals
  (`config/crawl-policy.yaml`'s `jsRendering` block, read but unused since
  Session 2).
- `html-extract.ts`'s `extractHtml(html, pageUrl)` is a pure function over
  an already-fetched HTML string — Session 6's Playwright-rendered page
  content can be run through the exact same extractor once rendered HTML
  is available, no new extraction logic needed.
- `link-check.ts`'s `checkPortalLinks` takes a portal-scoped
  `LinkOccurrence[]` and is fetch-mechanism-agnostic — links discovered
  from browser-rendered pages (Session 6) can be fed into the same
  function unchanged.
- Browser-rendered pages will discover links current server-rendered HTML
  cannot see at all (client-side-injected navigation) — expect materially
  higher link/page counts on allowlisted portals once Session 6 lands.

---

## Session 6 — Browser fallback

**Date:** 2026-08-31
**Goal:** Assess explicitly allowlisted client-rendered portals without
making browser automation the default (implementation.md section 14,
"Session 6").

### Files changed

- `packages/audit-core/src/browser-eligibility.ts` (new) — pure eligibility
  gate: `isBrowserFallbackEligible({ globalEnabled, perPortalAllowlist,
portalId, overrideEnabled })`.
- `packages/audit-core/src/browser-eligibility.test.ts` (new).
- `packages/audit-core/src/shell-detect.ts` (new) — pure empty-shell
  heuristic over pre-computed signals (`visibleTextLength`, `linkCount`,
  `hasAppRootMarker`, `htmlByteLength`).
- `packages/audit-core/src/shell-detect.test.ts` (new).
- `packages/audit-core/src/block-detect.ts` (new) — pure `detectAuthWall`
  and `detectCaptchaOrBlock` string-heuristics over rendered HTML.
- `packages/audit-core/src/block-detect.test.ts` (new).
- `packages/audit-core/src/crawl-errors.ts` — added `BROWSER_AUTOMATION_FAILURE`
  as a documented extra error code (same precedent as `SSRF_BLOCKED`/
  `SCOPE_EXCLUDED`), for genuine Playwright launch/crash failures that
  aren't a timeout/block/auth-wall.
- `packages/audit-core/src/index.ts` — exports the three new modules.
- `packages/audit-cli/src/crawl/browser-fetcher.ts` (new) — Playwright
  Chromium adapter (`fetchWithBrowser`) behind the same `FetchAttemptResult`
  shape `http-fetcher.ts` produces (extended, not duplicated, with an
  optional `screenshot` buffer), plus `BrowserManager` (one lazily-launched
  browser process reused across a run; every navigation gets a fresh,
  isolated `browser.newContext()`, closed immediately after).
- `packages/audit-cli/src/crawl/browser-fetcher.test.ts` (new) — 9 tests
  against real Chromium + local fixture servers: ordinary fetch, client
  redirect, CAPTCHA block, auth wall, timeout, resource cap, SSRF block,
  and `BrowserManager` reuse/launch-count behavior.
- `packages/audit-cli/src/crawl/html-extract.ts` — added
  `computeShellSignals(html, linkCount)`, the Cheerio-dependent half of
  shell detection (visible text length, SPA mount-point detection),
  feeding `audit-core`'s pure `detectEmptyShell`.
- `packages/audit-cli/src/crawl/evidence.ts` (new) — `writeScreenshotEvidence`
  (writes a PNG under `data/evidence/<runId>/<portalId>/<pageObservationId>.png`
  and returns a well-formed `EvidenceArtifact`, `privacyReviewed: false`)
  and `shouldCaptureBrowserEvidence` (the "selected evidence only" trigger,
  extracted as a pure function for direct unit testing).
- `packages/audit-cli/src/crawl/evidence.test.ts` (new).
- `packages/audit-cli/src/crawl/frontier.ts` — `FrontierPolicy` gained a
  `jsRendering` block; `FrontierDeps` gained `browserManager`,
  `portalBrowserOverride`, `evidenceOutDir`; `crawlPortal` now derives
  eligibility once per portal (before the loop), and inside the loop,
  after every successful HTML HTTP fetch, runs shell detection when
  eligible and dispatches `fetchWithBrowser` (respecting
  `maxBrowserPagesPerPortal`) producing a second `fetchMode: "browser"`
  `PageObservation` through the SAME `extractHtml` call as HTTP mode;
  `CrawlPortalResult` gained `evidenceArtifacts` and `browserFallbackUsed`.
- `packages/audit-cli/src/crawl/frontier.test.ts` — `makePolicy` helper
  updated with a (disabled) `jsRendering` block so existing tests keep
  typechecking.
- `packages/audit-cli/src/crawl/browser-fallback.test.ts` (new) — 8
  frontier-level integration tests: shell-triggered fallback recovering
  real content, global-switch-off (asserting zero browser launches),
  not-allowlisted-and-no-override (zero launches), override-enables-
  non-allowlisted-portal, disabling-override-wins-over-allowlist,
  browser-mode page cap with recorded skip reason, and equivalent schema
  output across fetch modes.
- `packages/audit-cli/src/crawl/write.ts` — `writeCrawlRunAtomic` now also
  writes `evidence-artifacts.jsonl` (same one-record-per-line convention).
- `packages/audit-cli/src/crawl/run.ts` — loads every
  `config/portals/*.yaml` override file (`loadPortalBrowserOverrides`,
  new), constructs one `BrowserManager` per run (closed on every exit path
  via a `finish()` wrapper), builds the `jsRendering` frontier-policy block
  from `crawlPolicy.jsRendering` (reusing `boundaries.requestTimeoutMs` as
  the browser navigation timeout, plus a fixed `BROWSER_SETTLE_TIMEOUT_MS
= 2000`), collects/validates/writes `EvidenceArtifact`s, and updates
  `AuditRun.limitations` text.
- `RunCrawlParams` gained optional `evidenceOutDir` (defaults to a sibling
  `evidence` directory next to `crawlOutDir` when omitted).
- `packages/audit-cli/src/commands/crawl.test.ts` — `crawlPolicyYaml`/
  `writeConfig` helpers extended with `browserFallbackEnabled`/
  `perPortalAllowlist`/`maxBrowserPagesPerPortal` parameters; added a new
  run-level wiring test proving a `config/portals/<id>.yaml` override file
  enables browser fallback end-to-end and `evidence-artifacts.jsonl` is
  written and schema-valid.
- `packages/audit-cli/package.json` — added `playwright` dependency.
- `.github/workflows/ci.yml` — added a step installing the Playwright
  Chromium browser (`pnpm --filter @panchnama/audit-cli exec playwright
install --with-deps chromium`) before the quality-gate steps.
- `README.md` — documented the local `playwright install chromium` step.
- `config/portals/README.md` — documented that `browserFallbackEnabled` is
  now read/enforced (Session 6), and that `maxPagesPerPortal`/`maxDepth`/
  `disabled` remain unread.

### Decisions

- **Common observation interface**: `browser-fetcher.ts`'s
  `fetchWithBrowser` returns `BrowserFetchResult`, which `extends
FetchAttemptResult` (imported directly from `http-fetcher.ts`, not
  reimplemented) plus an optional `screenshot?: Buffer`. This lets
  `frontier.ts` build a `PageObservation` from either an HTTP or a browser
  result with the same field-mapping code shape, and both feed the exact
  same `extractHtml` call — no duplicated extraction logic for browser
  mode, per the task brief's explicit requirement.
- **Eligibility gate + override/allowlist interaction**: documented in
  `browser-eligibility.ts`'s doc comment. `globalEnabled: false` is an
  absolute kill switch — nothing overrides it. When globally enabled, an
  explicit per-portal override (`config/portals/<id>.yaml`'s
  `overrides.browserFallbackEnabled`) is the most specific signal and wins
  in either direction over `perPortalAllowlist` membership: an enabling
  override activates a non-allowlisted portal (the "manual override" the
  spec asks for); a disabling override deactivates an allowlisted one. No
  override at all falls back to plain allowlist membership. Ordering is
  enforced structurally in `frontier.ts`: eligibility is computed once,
  before the crawl loop even starts, and the shell heuristic is only ever
  consulted inside the `if (browserEligible && ...)` branch — it is
  physically impossible for a non-eligible portal to reach shell detection.
- **Shell-detection heuristic**: implemented as a pure function in
  `audit-core` (`detectEmptyShell`) over signals Cheerio computes in
  `audit-cli` (`computeShellSignals`) — keeping the domain/dependency
  split established by prior sessions (pure logic in `audit-core`, I/O and
  DOM parsing in `audit-cli`). Thresholds: <200 chars visible text AND <3
  links, OR a dominant SPA mount-point element (`#app`/`#root`/`#__next`/
  `#__nuxt`/`[data-reactroot]`, body has ≤2 element children) with <400
  chars visible text. **Known false positives**: a legitimately minimal
  static page (e.g. a short "service unavailable" notice) can trip the
  thresholds and trigger an unnecessary (but capped, harmless) browser
  fallback attempt. **Known false negatives**: a client-rendered page that
  server-renders enough boilerplate chrome (nav/footer/cookie banner) to
  clear the text/link thresholds while still hiding its real content
  behind client-side JS will not be detected.
- **Resource-cap enforcement mechanism**: Playwright has no `fetch`-style
  streaming byte reader. Implemented by summing declared `content-length`
  response headers as they arrive (`page.on("response")`, which fires on
  headers-received, not body-complete) and racing that cumulative total
  against the in-flight `page.goto()`; the instant the cap is exceeded,
  the context is closed, aborting all further activity. Proven in
  `browser-fetcher.test.ts` with a fixture that declares a 5 MB
  `content-length` and then stalls the body forever — the fetcher returns
  `RESPONSE_TOO_LARGE` well within the test timeout, off the header alone,
  never waiting for (or needing) the stalled body. **Known limitation**: a
  single response already streaming when detected may continue arriving
  in the browser process briefly after the abort (Playwright's high-level
  API has no byte-level mid-stream cancel the way `http-fetcher.ts`'s
  `readBodyBounded` does); a response with no `content-length` header
  contributes zero to the running total until a later response reveals
  one.
- **Evidence-capture trigger condition**: `shouldCaptureBrowserEvidence`
  (pure, in `evidence.ts`) — capture only when the browser fetch either
  succeeded (`ok: true`, meaning it was dispatched because a shell was
  detected and it recovered content) OR was blocked
  (`AUTOMATION_BLOCKED`/`AUTH_REQUIRED`). An unrelated browser-mode failure
  (e.g. `READ_TIMEOUT`) does NOT capture a screenshot — there is nothing a
  screenshot would usefully explain. Unit-tested directly (5 cases) rather
  than only indirectly through a full browser fetch.
- **Evidence storage convention**: `data/evidence/<runId>/<portalId>/
<pageObservationId>.png`, with `EvidenceArtifact.storagePath` recording
  the path relative to `data/evidence/` (matching the schema's own doc
  note) and a new `evidence-artifacts.jsonl` file in the crawl run's
  output directory (same one-record-per-line convention as the other two
  `.jsonl` files), referencing artifacts by id. `privacyReviewed` is
  always `false` — no human review has happened yet; Session 8's
  publication gate is unaffected/unblocked by this.
- **Block/auth-wall detection heuristics**: `detectAuthWall` matches a
  login-shaped URL path plus a password field, OR both password+username
  fields present, OR a login-shaped URL path alone. `detectCaptchaOrBlock`
  matches a fixed list of common CAPTCHA-provider signatures (reCAPTCHA,
  hCaptcha, Turnstile, DataDome, FunCaptcha/Arkose) and common English bot-
  block interstitial phrasing. Both reuse the existing stable error codes
  (`AUTH_REQUIRED`, `AUTOMATION_BLOCKED`) rather than inventing new ones,
  per section 9.3. **Known limitations** (documented in each function's
  doc comment): non-English or custom-branded auth walls/block pages are
  not recognized; an auth wall at an unconventional path with no password
  field is missed; a page merely mentioning CAPTCHA/bot-detection in
  ordinary prose is a (low-probability, given the specific phrasing
  chosen) false-positive risk.
- **Browser navigation timeout / settle window**: reused
  `boundaries.requestTimeoutMs` directly as the browser navigation timeout
  (documented choice — avoids growing `crawl-policy.yaml`'s schema for a
  second, largely-equivalent timeout value). Added a small, hard-coded
  `BROWSER_SETTLE_TIMEOUT_MS = 2000` (not a config field) for the
  best-effort post-`domcontentloaded` `networkidle` wait — short and
  allowed to time out silently, since a page that never truly idles
  (websockets, polling) would otherwise stall every browser fetch.
- **Readiness signal**: `domcontentloaded` (fast, reliable) plus the short
  best-effort `networkidle` settle window above — not `load` and not a
  bare `networkidle` wait, both of which risk hanging on pages with
  long-lived connections. **Known limitation**: a page whose real content
  only appears after the settle window (deliberately staggered/lazy-loaded
  skeleton screens) can still be captured as an empty shell even in
  browser mode.
- **SSRF for browser mode**: Playwright doesn't route through Node's
  `fetch`, so `ssrf.ts`'s check-then-fetch path can't be reused directly.
  `browser-fetcher.ts` performs the identical DNS-resolve-then-classify
  step itself (calling the same `checkSsrf`/`isBlockedIpAddress`) before
  ever calling `page.goto()`, refusing to navigate at all on a block.
  Verified with a dedicated test asserting `errorCode: "SSRF_BLOCKED"` and
  `server.requestCount === 0` — no navigation attempt reaches the network.
  **Known limitation** (matching `http-fetcher.ts`'s own documented scope):
  only the entry navigation is SSRF-checked; a page that itself
  client-redirects to a different, resolvable-to-private host is not
  re-checked hop-by-hop the way `http-fetcher.ts` re-checks each
  server-side redirect.
- **Isolation (section 12.1)**: one `Browser` process per run (perf), but
  every navigation gets its own fresh `browser.newContext()`, closed
  immediately in a `finally` block — no cookies/storage ever persist
  across pages or portals. `BrowserManager.close()` is called on every
  `runCrawl` exit path (dry-run, validation failure, write failure,
  success) via a small `finish()` wrapper, so a browser is never left
  running past the run that launched it.
- **CI**: `.github/workflows/ci.yml` now runs `playwright install
--with-deps chromium` right after `pnpm install`, before lint/typecheck/
  test/build — required because the browser-fallback tests launch a real
  Chromium instance. Local developers run the same `playwright install
chromium` command once (documented in `README.md`).
- **Browser-mode frontier scope**: a browser fallback fetches ONLY the
  single triggering page — it does not expand the frontier queue from
  browser-discovered links (kept out of scope this session; recorded as a
  limitation). Links discovered on a successful browser-mode page ARE
  still fed into `linkOccurrences` for link-checking, same as HTTP mode.

### Tests run and results

```
pnpm lint        — pass (0 errors)
pnpm typecheck   — pass (6/6 packages)
pnpm test        — pass (322 tests across all packages;
                    audit-cli: 27 files / 179 tests, incl. 6 new
                    shell-detect/block-detect/browser-eligibility test
                    files in audit-core (18 tests), 9 new
                    browser-fetcher.test.ts cases (real Chromium + fixture
                    servers), 8 new browser-fallback.test.ts frontier-level
                    integration cases, 5 new evidence.test.ts cases, and 1
                    new run-level wiring case in commands/crawl.test.ts)
pnpm build       — pass (6/6 packages + Next.js app)
```

Playwright Chromium was already present in this environment's cache; for a
fresh environment/CI, install it first with:

```
pnpm --filter @panchnama/audit-cli exec playwright install chromium
```

(CI runs `--with-deps chromium` to also pull OS-level shared libraries.)

### Manual verification (local fixture portals, no live-internet targets)

Ran `runCrawl()` directly (test-only `ssrf.allowLoopbackForTests` override,
same pattern as Sessions 4/5) against three local fixture portals in one
run: an ordinary server-rendered portal, a shell-page portal that IS
allowlisted, and an identical shell-page portal that is NOT allowlisted.

```
crawl run: assam-2026-09-15-s6-manual
portals: 3
  [succeeded] ordinary-portal — 2 page(s)
  [succeeded] allowlisted-portal — 1 page(s)
  [succeeded] not-allowlisted-portal — 1 page(s)
status: completed
evidence artifacts: 1
browser fallback used: true
```

**Outcome 1 — ordinary-portal (HTTP mode succeeds normally, no shell, no
browser fallback):**

```json
{"fetchMode":"http","title":"Ordinary Portal","httpStatus":200}
{"fetchMode":"http","title":"Ordinary Portal","httpStatus":200}
```

**Outcome 2 — allowlisted-portal (HTTP fetch is an empty shell; browser
fallback correctly kicks in and finds real content):**

```json
{"fetchMode":"http","title":"Loading","httpStatus":200}
{"fetchMode":"browser","title":"Real Assam Portal Content","httpStatus":200}
```

`evidence-artifacts.jsonl` for this run contains exactly one schema-valid
`EvidenceArtifact` (`type: "screenshot"`, `privacyReviewed: false`),
referencing a PNG actually written under `data/evidence/<runId>/
allowlisted-portal/...png`.

**Outcome 3 — not-allowlisted-portal (the SAME shell page produces NO
browser fallback):**

```json
{ "fetchMode": "http", "title": "Loading", "httpStatus": 200 }
```

No second (browser-mode) observation was produced for this portal, and no
evidence artifact references it — confirming eligibility gating works
correctly even when the shell heuristic would otherwise fire.

### Known limitations (deferred/best-effort, explicit)

- Shell detection, auth-wall detection, and CAPTCHA/bot-block detection are
  all best-effort heuristics with documented false-positive/false-negative
  limits (see Decisions above) — none claim complete or perfect coverage.
- Browser fallback fetches only the single triggering page; it never
  expands the frontier queue from browser-discovered links.
- The resource cap is enforced off declared `content-length` headers, not
  true mid-stream byte accounting; a response already in flight when the
  cap trips may finish arriving briefly after the abort.
- SSRF checking for browser mode covers only the entry navigation, not
  hop-by-hop client-side redirects to a different host.
- `config/portals/*.yaml`'s `maxPagesPerPortal`, `maxDepth`, and `disabled`
  override fields remain unread/unenforced (unchanged from Session 2/4).
- Playwright requires its Chromium browser binary to be installed
  separately from `pnpm install` (`playwright install chromium`) — a
  fresh developer machine or CI image without this step will fail every
  browser-fallback test with a clear Playwright error, not a silent
  skip. CI now installs it automatically; this is a real, documented
  environment dependency risk for anyone running `pnpm test` outside CI
  for the first time.

### Next session prerequisites (Session 7 — Deterministic audit rules)

- `PageObservation.fetchMode` now genuinely takes both `"http"` and
  `"browser"` values in real crawl output; Session 7's technical-health/
  finding derivation must treat both fetch modes as valid successful
  observations (a `browser`-mode success is not itself evidence of
  degradation).
- `PageObservation.errorCode` values `AUTH_REQUIRED` and
  `AUTOMATION_BLOCKED` are now genuinely produced (previously only
  theoretically documented in `crawl-errors.ts`) — Session 7 should map
  these to `not_assessable` per section 7.1's
  `availability.automation-blocked.v1` example rule and section 5.14's
  "`not_assessable` must include a reason" invariant (the `errorCode` plus
  `errorMessage` already carry that reason).
- `EvidenceArtifact` records now exist in real crawl output for the first
  time (`evidence-artifacts.jsonl` in each run's output directory,
  `privacyReviewed: false`). Session 7/8 will need to reference these by
  id from generated `Finding.evidenceRefs`, and Session 8's publication
  gate must enforce that only `privacyReviewed: true` artifacts are
  citable (unchanged requirement, now with real data to enforce it
  against).
- A portal-level `browserFallbackUsed` signal is directly computable from
  a run's own `page-observations.jsonl` (`pageObservations.some(o =>
o.fetchMode === "browser")`) — this is what
  `PublishedPortalAssessment.crawlCoverage.browserFallbackUsed` should be
  derived from when Session 8 wires publication; no new schema field was
  needed to make this signal available.

---

## Session 7 — Deterministic audit rules

**Date:** 2026-08-31
**Goal:** Convert raw observations into explainable candidate findings
(implementation.md section 14, "Session 7").

### Files changed

- `packages/audit-core/src/rules/types.ts` (new) — shared rule-engine
  types: `Rule`, `FindingDraft`, `EvidenceDraft`, `PortalRuleInput`,
  `AnalysisContext`.
- `packages/audit-core/src/rules/params.ts` (new) — `readIntParam` helper
  for reading typed thresholds out of `config/checks.yaml`'s
  `Record<string, unknown>` parameters.
- `packages/audit-core/src/rules/availability.ts` (new) — six rules:
  `availability.unavailable.v1`, `availability.server-error.v1`,
  `availability.not-found.v1`, `redirect.cross-domain.v1`,
  `availability.automation-blocked.v1`, and a new
  `availability.access-restricted.v1` (the 401/403 carve-out).
- `packages/audit-core/src/rules/broken-link.ts` (new) —
  `broken_link.repeated-failure.v1`.
- `packages/audit-core/src/rules/https.ts` (new) —
  `https.certificate-failure.v1`, `https.no-tls-upgrade.v1`.
- `packages/audit-core/src/rules/freshness.ts` (new) —
  `freshness.no-signal.v1` (see "Freshness" decision below).
- `packages/audit-core/src/rules/directory-mismatch.ts` (new) — three
  rules: `directory_mismatch.unavailable-destination.v1`,
  `directory_mismatch.listed-vs-observed.v1`,
  `directory_mismatch.official-portal-not-listed.v1`.
- `packages/audit-core/src/rules/crawl-coverage.ts` (new) —
  `crawl_coverage.summary.v1`.
- `packages/audit-core/src/rules/registry.ts` (new) — `ALL_RULES`,
  `getRuleById`, `selectEnabledRules` (turns a loaded `ChecksConfig`-shaped
  array into the rules this registry actually implements), and
  `runPortalRules` (runs a portal's selected rules in a fixed order,
  threading each rule's output into later rules' `priorFindings`).
- `packages/audit-core/src/technical-health.ts` (new) —
  `deriveProvisionalTechnicalHealth` (see "Provisional vs. final technical
  health" below).
- `packages/audit-core/src/suggestion.ts` (new) — `SUGGESTION_TEMPLATES`
  (section 7.8's table, documented) and `AVAILABILITY_ONLY_RULE_IDS`, used
  by the `review_retirement` regression guard.
- `packages/audit-core/src/index.ts` — exports every new module; updated
  doc comment (this session populated the package for real, no longer a
  placeholder).
- `packages/audit-core/package.json` — added `@panchnama/schema` and
  `zod` as real dependencies (previously audit-core had none; rules
  operate on schema types).
- Table-driven test files for every rule module, plus
  `technical-health.test.ts` and `suggestion.test.ts` (the
  `review_retirement` regression guard).
- `packages/audit-cli/src/analyze/materialize.ts` (new) — turns a rule's
  `FindingDraft` into a real `Finding` + one `EvidenceArtifact` per
  `EvidenceDraft`, writing each evidence draft's serialized content to
  `data/evidence/<runId>/analysis/<evidenceId>.json`.
- `packages/audit-cli/src/analyze/write.ts` (new) — atomic write for
  `data/raw/analysis/<runId>/` (`findings.jsonl`,
  `evidence-artifacts.jsonl`, `manifest.json`,
  `provisional-technical-health.json`), mirroring `crawl/write.ts`'s
  stage-then-move convention; supports an explicit `overwrite` override
  (unlike `crawl`'s unconditional refusal) per this session's brief.
- `packages/audit-cli/src/analyze/run.ts` (new) — `runAnalyze`: loads the
  crawl run (`AuditRun`/`PageObservation`/`LinkObservation`/skip-log) and
  the referenced inventory run (`Portal`/`InventorySource`), loads
  `checks.yaml`/`crawl-policy.yaml`, runs every enabled+implemented rule
  per portal, materializes findings/evidence, validates every record
  against the Zod schemas (including that every `evidenceRefs` entry
  resolves to a materialized artifact) before writing.
- `packages/audit-cli/src/analyze/fixture.ts` (new) — `runAnalyzeFixture`,
  the `--portal <id> --fixture` dev command (see "`--fixture` meaning"
  below).
- `packages/audit-cli/src/commands/analyze.ts` (new), plus
  `packages/audit-cli/src/commands/analyze.test.ts` (new, end-to-end:
  real fixture HTTP servers + real `runCrawl` + real `runAnalyze`).
- `packages/audit-cli/src/cli.ts` — added the `analyze` case (both
  `--run-id` and `--portal --fixture` forms) to the dispatcher switch.
- `config/checks.yaml` — added rule-id entries for every rule this
  session implements beyond the original five illustrative entries
  (`availability.access-restricted.v1`, `broken_link.repeated-failure.v1`,
  `https.certificate-failure.v1`, `https.no-tls-upgrade.v1`,
  `freshness.no-signal.v1`, the three `directory_mismatch.*` rules,
  `crawl_coverage.summary.v1`), each with a comment explaining what it
  does — config and code are kept in sync (no rule without a config entry,
  no config entry without an implementing rule).

### Decisions

- **Rule-registry structure.** A rule is `{ ruleId, version, category,
description, evaluate(input, context, parameters) }`, pure and
  side-effect-free. `packages/audit-core` never allocates a record id,
  never materializes evidence, never touches disk — it only returns
  `FindingDraft[]` (a finding shape carrying `EvidenceDraft[]` instead of
  resolved `evidenceRefs`). `packages/audit-cli`'s `analyze/materialize.ts`
  is the ONLY place ids are minted and evidence is written to disk,
  matching the pure-logic-in-core / orchestration-in-cli split every prior
  session established. `directory_mismatch` rules run last (via
  `ALL_RULES`'s fixed order) because `unavailable-destination.v1`
  cross-references availability findings already produced earlier in the
  same portal's pipeline run, via `PortalRuleInput.priorFindings`.
- **"Spaced attempts" interpretation, and a real correction discovered
  during end-to-end testing.** The original plan assumed a real crawl run
  might contain multiple `PageObservation` records for the same entry URL
  (one per attempt). Building the end-to-end test revealed this is wrong:
  `frontier.ts`'s frontier visits each distinct URL once per run, and
  `http-fetcher.ts`'s own retry loop (which retries
  `DNS_FAILURE`/`CONNECT_TIMEOUT`/`READ_TIMEOUT`/`HTTP_SERVER_ERROR`, up to
  `maxAttemptsAvailabilityCritical`, but never 404/410) already folds
  retries into ONE final `PageObservation` whose `attempt` field records
  the retry count. The three attempt-counting availability rules
  (`unavailable`, `server-error`, `not-found`) were fixed to compare
  against `max(matching-observation-count, matching-observation.attempt)`
  — this handles both the real single-observation-with-a-retry-count case
  and (for rule-boundary unit tests, and a possible future
  `analyze --compare-run` capability) a hypothetical multi-observation
  case identically. This is still a documented proxy for section 7.1's
  "3 spaced attempts" (spread over real time), not true multi-run temporal
  spacing — every triggered `availability.unavailable.v1` finding carries
  this limitation explicitly in its `limitations` array. A consequence
  worth flagging: because 404/410 is never retried by the fetch layer,
  `availability.not-found.v1` cannot fire from a single real crawl run
  under ordinary circumstances (its own `limitations` array says so) —
  this rule is effectively dormant until either the crawler visits an
  entry URL more than once in a run, or a future cross-run comparison
  capability is built. Its boundary logic is still exercised directly by
  unit tests against synthetic multi-observation input.
- **401/403/CAPTCHA/login-wall carve-out.** A raw 401
  (`errorCode: "AUTH_REQUIRED"`) or 403 (`errorCode: "HTTP_CLIENT_ERROR"`,
  `httpStatus: 403`) on the entry page never counts toward
  `availability.unavailable.v1`/`server-error.v1`/`not-found.v1`'s failure
  counts. A new rule, `availability.access-restricted.v1` (added to
  `config/checks.yaml` since it wasn't in the original five illustrative
  entries), surfaces it instead as `checkStatus: "not_assessable"`,
  `confidence: "low"`, `severity` never `"critical"`, `reviewStatus:
"pending_review"` — matching section 7.1's explicit instruction.
- **Freshness-signal raw-body-availability resolution.** `PageObservation`
  (§5.5) stores only `bodyDigest` (a hash), `title`, `canonical`, and
  `language` — never raw page text — and Sessions 4-6 never persisted raw
  crawled HTML bodies to disk anywhere `analyze` could read them. This
  session took choice (a) from its own brief: skip real content-level
  freshness extraction entirely rather than extend Session 4-6's crawler
  output for a capability outside this session's explicit implement list.
  `freshness.no-signal.v1` emits only `no_freshness_signal` (never
  `potentially_stale`, since no actual signal is ever inspected), always
  `reviewStatus: "pending_review"`, with the exact reason recorded in
  `limitations`. Real content-level freshness extraction (last-updated
  dates, copyright years, dated notices) remains a documented gap for a
  future session/ADR — if pursued, the most defensible approach is
  probably adding raw-body persistence to the crawler (Session 4/5
  territory) as a small, explicitly-flagged additive change, not doing
  text extraction blind inside `analyze` from data that doesn't exist.
- **Broken-link severity simplification.** Section 7.2 asks for elevated
  severity for "prominent service links and links from official
  directories," but individual `LinkObservation`s carry no per-link
  directory-provenance tag. `broken_link.repeated-failure.v1` uses two
  coarser proxies instead: (1) whether the _linking portal itself_ is
  backed by an `official_directory`/`official_page`-typed `InventorySource`
  (via `Portal.sourceRefs`, cross-referenced against the loaded inventory
  run — `analyze` does load `data/raw/inventory/<runId>/`) → critical; (2)
  otherwise, breadth (≥3 distinct source pages linking to the same dead
  destination) → significant; single unofficial broken link → advisory.
  Documented as a real simplification versus true per-link provenance in
  every triggered finding's `limitations`.
- **Crawl-coverage representation.** One low-severity/advisory
  `crawl_coverage.summary.v1` finding per portal per run (not folded
  silently into every other finding's `limitations`), summarizing pages
  observed vs. the configured `maxPagesPerPortal`/`maxDepth`, and what was
  skipped and why (from the crawl run's own `skip-log.json`, filtered by
  `portalId`). `checkStatus` is `"not_applicable"` when coverage was
  complete, `"warning"` when a limit was hit or something was skipped.
- **Provisional vs. final technical health.** Section 7.7 defines
  `TechnicalHealth` in terms of _reviewed_ findings, and no
  `ReviewDecision` records exist until Session 8. `deriveProvisional
TechnicalHealth` (in `technical-health.ts`) is explicitly documented, in
  its own doc comment and in `analyze`'s output file name
  (`provisional-technical-health.json`) and manifest `limitations`, as a
  PRE-REVIEW, PROVISIONAL computation over this session's _candidate_
  findings — never the final published value shown to end users. Session
  8 must recompute the real `TechnicalHealth` from reviewed-only findings.
- **Evidence-artifact materialization convention.** Every `EvidenceDraft`
  a rule returns is written by `analyze/materialize.ts` to
  `data/evidence/<runId>/analysis/<evidenceArtifactId>.json` (the
  serialized JSON content the rule built, e.g. a redirect chain or a set
  of failing observations), mirroring Session 6's
  `data/evidence/<runId>/<portalId>/<pageObservationId>.png` screenshot
  convention. Every materialized `EvidenceArtifact` gets
  `privacyReviewed: false` (no automated evidence is privacy-reviewed
  until Session 8's human review), and `analyze` explicitly asserts (both
  in code, before writing, and in a dedicated end-to-end test) that every
  generated `Finding.evidenceRefs` value resolves to one of the artifacts
  it just materialized.
- **`analyze` output location and overwrite policy.** `data/raw/analysis/
<runId>/` (mirroring `data/raw/crawl/<runId>/` and `data/raw/inventory/
<runId>/`), with a `latest` pointer file matching the established
  convention. Unlike `crawl`'s unconditional refusal to overwrite,
  `analyze` accepts an explicit `--force` CLI flag / `overwrite: true`
  param — matching this session's brief ("never overwrites ... without an
  explicit override," implying an override path should exist). Without
  `--force`, a second `analyze --run-id <same-id>` refuses and exits
  non-zero (covered by a dedicated test).
- **`--fixture` flag meaning.** `analyze --portal <portal-id> --fixture`
  runs the rule registry against a small, deterministic, BUILT-IN
  observation set for one synthetic portal (a portal that fails 3 attempts
  and has one broken link) — not real crawl output on disk. It prints
  candidate findings and provisional technical health to stdout and never
  writes to `data/raw/`. This is a fast rule-iteration/dev tool, not a
  substitute for the real `--run-id` path.

### Tests run and results

```
pnpm lint       — pass (0 errors)
pnpm typecheck  — pass (6/6 packages)
pnpm test       — pass (391 tests total: apps/web 2, database 1, schema 64,
                   ui 1, audit-core 136 [18 test files, incl. new
                   rules/*.test.ts, technical-health.test.ts,
                   suggestion.test.ts], audit-cli 181 [28 test files, incl.
                   new commands/analyze.test.ts real end-to-end crawl+
                   analyze cases])
pnpm build      — pass (6/6 packages + Next.js app)
pnpm format     — applied (formatting only, no behavior changes)
```

Key new tests:

- Table-driven boundary tests (one-below / at-threshold / above-threshold)
  for every availability rule, `broken_link`, `https`, `freshness`,
  `crawl_coverage`, and all three `directory_mismatch` rules.
- `suggestion.test.ts`: runs every availability rule against
  worst-case/heavy-failure fixtures and asserts none ever produces
  `suggestedAction: "review_retirement"` (implementation.md §7.8/§5.14).
- `technical-health.test.ts`: table-driven boundary cases for
  unavailable/degraded/healthy/not_assessable, including precedence when
  multiple signals are present at once.
- `commands/analyze.test.ts`: real end-to-end test — starts two real
  local HTTP fixture servers, runs a real `runCrawl` against them
  (one healthy portal with one broken external link, one totally
  unreachable portal), then runs real `runAnalyze` on that crawl's actual
  output, and asserts on schema validity, evidence-ref resolution,
  specific expected findings per portal, and the `review_retirement`
  guard — plus a second test asserting `analyze` refuses to silently
  overwrite existing output.

### Manual verification (real crawl + analyze against local fixture servers)

Ran the compiled CLI's `runCrawl` then `runAnalyze` directly (test-only
`ssrf.allowLoopbackForTests` override, same pattern as Sessions 4-6)
against two local fixture portals: one healthy portal whose only page
links to a service that returns 503, and one portal pointing at a closed
port (immediate connection failure).

```
crawl run: assam-manual-s7-crawl
portals: 2
  [partial] manual-good-portal — 2 page(s)
  [failed] manual-unreachable-portal — 1 page(s)
status: failed
page observations: 3
link observations: 1

analyze run: assam-manual-s7-crawl
portals analyzed: 2
rules enabled and implemented: 14
findings: 9
evidence artifacts: 9
```

Selected findings (full JSON abbreviated to the essentials each finding
must explain, per this session's exit criterion):

```
[manual-good-portal] broken_link.repeated-failure.v1 | broken_link
  severity=critical confidence=high action=repair
  "The destination http://127.0.0.1:58881/service failed from 1 source
   page(s) on this portal (HTTP_SERVER_ERROR)."
  evidenceRefs: [evidence-finding-...-broken_link.repeated-failure.v1-1-2]
  limitations: [elevated because the linking portal is officially sourced,
   not per-link provenance]

[manual-unreachable-portal] availability.unavailable.v1 | availability
  severity=critical confidence=high action=repair
  "Unavailable during 3 checks on 2026-08-31."
  evidenceRefs: [evidence-finding-...-availability.unavailable.v1-11-12]
  limitations: ["Spaced attempts" = within-run retry proxy, documented]

[manual-unreachable-portal] directory_mismatch.unavailable-destination.v1
  severity=advisory confidence=medium action=manual_assessment
  "The official directory linked to a destination that returned an
   availability failure (availability.unavailable.v1)."
```

`provisional-technical-health.json`:

```json
{ "manual-good-portal": "degraded", "manual-unreachable-portal": "unavailable" }
```

No finding across either portal ever set `suggestedAction:
"review_retirement"`. All 9 findings and 9 evidence artifacts validated
against the Zod schemas, and every `evidenceRefs` entry resolved.

### Known limitations (deferred, explicit)

- True multi-run temporal spacing for availability rules ("3 spaced
  attempts" over real elapsed time, using `minSpacingMinutes`) is not
  implemented — this session uses within-run retry-attempt counts as a
  documented proxy. A future `analyze --compare-run <id>` capability could
  add this without changing rule shapes.
- `availability.not-found.v1` cannot fire from real single-run crawl data
  under ordinary circumstances, because the fetch layer never retries
  404/410 — it is exercised only by direct unit tests against synthetic
  input. This is a structural consequence of the single-run limitation
  above, not a bug.
- Real content-level freshness-signal extraction (last-updated dates,
  copyright years, dated notices) is not implemented — `analyze` has no
  raw page text to inspect, only structured `PageObservation` fields.
  Every portal gets only `freshness.no-signal.v1`, never
  `potentially_stale`.
- Broken-link severity elevation uses the linking portal's own
  inventory-source type as a proxy for "link from an official directory,"
  not true per-link directory provenance (not tracked at the
  `LinkObservation` level).
- "Multiple directory entries appear to represent the same portal"
  (§7.5's fourth bullet) is not detected this session.
- No rule in this registry auto-generates a `possible_overlap` finding —
  section 7.6's manual-review-first workflow (a completed, human-authored
  `PortalOverlapComparison`) is Session 8's job.
- `deriveProvisionalTechnicalHealth`'s output is explicitly provisional/
  pre-review; it must not be treated as the final published
  `TechnicalHealth` anywhere downstream until Session 8 recomputes it from
  reviewed-only findings.
- `analyze`'s `--inventory-run-id` defaults to the inventory build
  referenced by `readLatestInventoryRunId`, not necessarily the exact
  inventory build a given crawl run actually crawled against — if the
  inventory has been rebuilt between crawl and analyze, portal records
  could theoretically drift. No cross-check exists yet linking a crawl
  run's manifest to a specific inventory run id (the crawl manifest does
  not currently record which inventory run it used); recorded here as a
  reproducibility gap worth revisiting in a later session.

### Next session prerequisites (Session 8 — Review and publication pipeline)

- This session's `data/raw/analysis/<runId>/findings.jsonl` and
  `evidence-artifacts.jsonl` are Session 8's primary input. Every
  `Finding.reviewStatus` produced this session is one of
  `"pending_review"`, `"automated_observation"`, or `"not_assessable"` —
  never `"reviewed"`. Session 8 must add `ReviewDecision` records (§5.11)
  separate from this generated data, and implement `review:validate` and
  `publish` per the deferred §5.14 invariants already flagged as TODOs in
  `packages/schema/src/finding.ts` (evidence `privacyReviewed` resolution,
  overlap-comparison relationship checks, review-decision presence for
  interpretive findings, and re-confirming `review_retirement` is never
  reachable from technical failure alone even after review overrides).
- Every materialized `EvidenceArtifact` this session produces has
  `privacyReviewed: false` — Session 8's publication gate must flip this
  only after actual human privacy review, and must refuse to publish any
  finding whose evidence hasn't been reviewed (§8.3 item 3).
- `provisional-technical-health.json` (this session's output) is NOT the
  final `TechnicalHealth` — Session 8/11 must compute the real,
  publishable value from _reviewed_ critical/significant findings only,
  using `deriveProvisionalTechnicalHealth`'s shape as a starting point but
  feeding it reviewed findings instead of raw candidates.
- `SUGGESTION_TEMPLATES` in `packages/audit-core/src/suggestion.ts`
  already includes the `possible_overlap` → `review_consolidation` and
  "apparent obsolete + corroborating evidence" → `review_retirement` rows
  for when Session 8's manual overlap/retirement workflows need them —
  no rule in this session's registry calls them.
- The rule registry (`packages/audit-core/src/rules/registry.ts`) is
  designed to be easy to extend: a new rule just needs a `Rule` object
  added to the relevant category array and a matching `config/checks.yaml`
  entry; `selectEnabledRules`/`runPortalRules` require no changes.
