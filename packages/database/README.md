# @panchnama/database

Drizzle schema, migrations, connection lifecycle, and typed repository
functions for anonymous citizen-experience submissions, offline moderation,
and abuse-key storage (implementation.md section 9.5). PostgreSQL only.
This package never stores crawler or audit observations — those remain
static, versioned datasets under `data/`, produced by `packages/audit-cli`.

## Tables

- `experience_submissions` — immutable original record (everything the
  citizen typed/chose, including the original `freeText`).
- `experience_moderation` — one-to-one decision record (`status`,
  `moderatedAt`, `moderationReasonCode`, redacted `publicText`), kept
  separate from the original per implementation.md section 5.14.
- `experience_abuse_keys` — one row per submission-attempt event (keyed
  hash + portal + timestamp + expiry), never a raw IP address.
- `experience_schema_meta` — single-row table recording which
  `@panchnama/schema` `ExperienceSubmission`/`PortalExperienceSummary`
  schema version this database was last migrated against.

See the doc comments in `src/schema/*.ts` and `src/repository/*.ts` for the
full design rationale (table split, UUID generation, themes storage,
abuse-key event-log shape, `portal_id` validation approach, etc).

## Local development

```bash
cp .env.example .env.local     # then edit if you changed any POSTGRES_* default
pnpm db:up                     # start local Postgres via Docker Compose
pnpm db:migrate                # apply committed migrations
pnpm db:seed                   # idempotent deterministic dev data
pnpm db:check                  # reachability + migration-freshness check
pnpm experiences:queue         # list pending submissions
pnpm experiences:moderate --id <id> --decision approve
pnpm experiences:aggregate     # print PortalExperienceSummary per fixture portal
pnpm experiences:retention     # apply the retention policy
pnpm db:studio                 # local-only Drizzle Studio UI
pnpm db:down                   # stop Postgres; the named volume is NOT deleted
pnpm db:reset:destructive      # DANGEROUS: stops Postgres AND deletes the volume
```

All `db:*`/`experiences:*` commands are also available as root
`package.json` scripts (`pnpm db:up`, `pnpm experiences:queue`, etc.) — see
the repo root README/`package.json`.

## Environment configuration

- `DATABASE_URL` — the database every `db:*`/`experiences:*` command uses.
- `TEST_DATABASE_URL` — a **separate** database (different name, e.g.
  `panchnama_test`) used only by this package's integration test suite.
  Must never equal `DATABASE_URL` — `src/testSupport/testDb.ts` refuses to
  run if it does, since the tests truncate tables between every test.
- `EXPERIENCE_RETENTION_REJECTED_DAYS` / `EXPERIENCE_ABUSE_KEY_TTL_HOURS` —
  optional overrides for the retention policy (defaults: 90 / 24).
- `EXPERIENCE_ABUSE_KEY_SECRET` — reserved for Session 10's rate limiter.
  No code in this package reads it.

Local/test database configuration is what this session sets up concretely
(env-var driven, both point at local Postgres by default). Preview and
production databases are **documented expectations, not infrastructure
this session provisions**: point `DATABASE_URL` at a managed Postgres
instance (with the hosting provider's automated backup/point-in-time-
recovery feature enabled — this prototype does not implement custom backup
tooling) once an ADR names the actual host (implementation.md section 3's
"Application hosting" row requires an ADR before Session 22).

`pnpm db:down` (plain `docker compose down`) never deletes the named
volume — stopping the service does not delete data. Only
`pnpm db:reset:destructive` (`docker compose down -v`) does; treat it as
local-only and dangerous.

## Running the integration test suite

These are real tests against a real Postgres database — nothing in this
package's test suite mocks Drizzle or postgres.js. To run them:

```bash
pnpm db:up
DATABASE_URL=postgres://panchnama:panchnama@localhost:5432/panchnama \
  pnpm --filter @panchnama/database run db:migrate
TEST_DATABASE_URL=postgres://panchnama:panchnama@localhost:5432/panchnama_test \
  pnpm --filter @panchnama/database exec tsx src/scripts/migrate.ts
pnpm --filter @panchnama/database test        # or: pnpm test from the repo root
```

If `TEST_DATABASE_URL` is unset or unreachable, every `*.integration.test.ts`
file in this package is **skipped** (not failed) with a console warning —
so `pnpm test` at the repo root stays green for a contributor who hasn't
set up Postgres locally. A CI pipeline that wants these tests to actually
execute must provision a Postgres service and export `TEST_DATABASE_URL`
(and run `db:migrate` against it) before `pnpm test`; this repository's own
CI workflow configuration is not part of this session's scope (Session 0's
`.github/workflows/` did not include a Postgres service, and adding one is
a documented follow-up, not done here — see docs/session-log.md).

`*.integration.test.ts` files disable Vitest's file-level parallelism for
this package (`vitest.config.ts`) because they share one test database and
`migration.integration.test.ts` drops/recreates tables.

## Sandboxed-environment note (this session's own verification)

This session's own verification was run in a sandbox without Docker
available. A local Homebrew-installed PostgreSQL 16 instance (`pg_ctl`,
two databases: `panchnama` and `panchnama_test`) stood in for `docker
compose` for that verification only — `docker-compose.yml` itself is the
real, intended local-development mechanism and was not exercised by
`docker compose` in this particular session's sandbox. See
docs/session-log.md for the exact commands and output.
