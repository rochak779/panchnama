# Panchnama

Panchnama is a repeatable, evidence-backed public audit that shows which
Assam government websites need attention, why they were flagged, and what
should happen next — with dated evidence anyone can inspect.

It is an **independent case-study prototype**, not affiliated with or
endorsed by the Government of Assam.

## The problem

Government websites are created and maintained by separate departments,
boards, authorities, and vendors, with no readily inspectable, continuously
reproducible view of the observed web estate. Panchnama audits an
explicitly bounded **observed web estate** — assembled from named official
sources — to answer questions such as:

- Which official portals are reachable?
- Which official pages lead citizens to broken destinations?
- Which portals have HTTPS or certificate problems?
- Which portals show credible signs of stale or obsolete content?
- Which official websites are missing from directories, or which directory
  entries no longer resolve?
- Which portals appear to perform overlapping functions and deserve human
  review?
- What evidence supports each finding, and what action should an owner
  consider?

Panchnama also accepts anonymous, structured, moderated citizen-experience
submissions about listed portals. These are displayed separately from
technical findings and never automatically change an audit verdict.

See [`implementation.md`](./implementation.md) for the full product
definition, domain model, crawl policy, audit rules, and session-by-session
build plan. That file is the authoritative specification for this
repository.

## Product principles (summary)

1. Evidence before judgment — every finding cites a URL, observation,
   timestamp, and rule.
2. No false precision — no composite score across unrelated checks.
3. Uncertainty is visible — `Not assessable` and `Review required` are
   legitimate outcomes.
4. Observed estate, not claimed completeness.
5. Automation collects evidence; people make policy judgments.
6. Citizen impact drives severity, not technical novelty.
7. A dated, repeatable snapshot — not a live monitoring service.
8. Independent and non-official.
9. Citizen experience is displayed separately from technical health.
10. Privacy by default — no names, accounts, IDs, phone numbers, or
    documents are collected.

Full detail: implementation.md section 1 and section 3 ("Locked product
decisions").

## Repository structure

```text
apps/web/                # Next.js public scorecard (App Router)
packages/audit-cli/      # inventory, crawl, analyze, publish commands
packages/audit-core/     # pure audit rules and classifiers
packages/database/       # Drizzle schema, migrations, DB access
packages/schema/         # shared Zod schemas and TypeScript types
packages/ui/             # optional shared UI primitives
config/                  # source registry and crawl/check policy
data/                    # seed, raw, evidence, review, published, fixtures
docs/                    # methodology, ADRs, session log, research
scripts/                 # repository-maintenance scripts
.github/workflows/       # CI
```

This structure — and everything else in this README — implements
implementation.md section 4.3. Most of `packages/`, `apps/web`, `config/`,
and `data/` are currently scaffolds; see each package's `README.md` and
`docs/session-log.md` for what has actually been built versus what is
placeholder for a later session.

## Requirements

- Node.js 22 LTS or later
- pnpm 9 or later (see `packageManager` in `package.json` for the pinned
  version used in CI)

## Local commands

```bash
pnpm install       # install workspace dependencies

pnpm lint          # ESLint across the whole repository
pnpm lint:fix
pnpm format        # Prettier — write
pnpm format:check  # Prettier — check only
pnpm typecheck     # tsc --noEmit in every workspace package
pnpm test          # Vitest in every workspace package
pnpm build         # build every workspace package (tsc / next build)
```

These four — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — are
the quality gates that must pass before merging any session
(implementation.md section 11.3).

Database and audit-CLI commands (`pnpm db:*`, `pnpm audit *`,
`pnpm experiences:*`) are introduced by the sessions that build the
database and CLI (see `docs/session-log.md`) and are not available yet.

## Deploy

This is a pnpm workspace monorepo; the deployable app is `apps/web`, a
Next.js site whose audit data (portals, findings, methodology, exports) is
built statically from `data/fixtures/*.json` at build time — no database
is required to serve the scorecard.

To deploy on Vercel:

1. Import this repository into a new Vercel project.
2. Set **Root Directory** to `apps/web`.
3. Framework preset: Next.js (auto-detected). Build command
   (`pnpm run build`, which runs `build:exports` then `next build`) and
   install command are picked up automatically once the root directory is
   set — no overrides needed.
4. Deploy. No environment variables are required for the scorecard itself.

Optional: the citizen-experience submission feature (`/api/experiences`)
needs a Postgres database (`DATABASE_URL`, see `.env.example`) to work. If
it isn't set, those endpoints degrade to a 503 and the rest of the site —
including the scorecard, findings, and exports — is unaffected.

### Browser-fallback crawl tests (Playwright)

The crawler's allowlisted browser-rendering fallback (implementation.md
section 6.4) is implemented with Playwright. Its tests launch a real
headless Chromium instance against local fixture HTTP servers only — never
live internet targets. Before running `pnpm test` (or
`pnpm --filter @panchnama/audit-cli test`) for the first time, install the
Chromium browser binary:

```bash
pnpm --filter @panchnama/audit-cli exec playwright install chromium
```

CI installs this automatically (see `.github/workflows/ci.yml`).

## Contributing / working with an AI coding agent

See [`AGENTS.md`](./AGENTS.md) for repository-specific rules, and
`implementation.md` section 15 for the standard per-session prompt.
