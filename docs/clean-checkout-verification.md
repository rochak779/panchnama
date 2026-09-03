# Clean-checkout verification

Verified 2026-09-03 (Session 19) by running, from a fully clean state:

```
rm -rf apps/web/.next apps/web/dist packages/*/dist node_modules apps/web/node_modules packages/*/node_modules
pnpm install --frozen-lockfile
pnpm build      # exit 0
pnpm typecheck  # exit 0
pnpm test       # exit 0
pnpm lint       # exit 0
```

**Ordering note:** `pnpm build` must run before `pnpm typecheck` and
`pnpm test` on a genuinely clean checkout (no `dist/` anywhere). This
repo's workspace packages (`@panchnama/schema`, `@panchnama/database`,
etc.) publish their type declarations and runtime entry points from
`dist/` (`package.json`'s `"types"` and `"exports"` fields), which only
exists after `pnpm build` runs. Running the commands in the order
`lint → typecheck → test → build` — as currently written in
`.github/workflows/ci.yml` and in this task's own brief — fails on a
truly clean checkout: `pnpm typecheck` errors with `Cannot find module
'@panchnama/schema'` in `packages/audit-core`, and `pnpm test` fails two
files in `packages/database` (`mapping.test.ts`,
`repository.integration.test.ts`) with `Failed to resolve entry for
package "@panchnama/schema"`. Both pass cleanly once `pnpm build` has
run first — this is a real, pre-existing repo build-ordering issue
(unrelated to Session 19's work), not a static-generation regression.
It should be fixed in `.github/workflows/ci.yml` (reorder to build
before typecheck/test) as a follow-up; this doc records the order that
actually succeeds today. `pnpm lint` is unaffected by this ordering —
it does not depend on any workspace package's build output.

Every audit page (`/`, `/inventory`, `/methodology`, `/exports`,
`/privacy`, `/portals/[portalId]`, `/portals/[portalId]/share-experience`)
prerenders as static output (`○`/`●` in `next build`'s route table); only
`/api/experiences` and `/api/portals/[portalId]/experiences` are dynamic
(`ƒ`), which is expected — they're the only routes that touch the
database (implementation.md §10.6). Actual route table from this run:

```
Route (app)                                                     Size  First Load JS
┌ ○ /                                                          779 B         107 kB
├ ○ /_not-found                                                987 B         103 kB
├ ƒ /api/experiences                                           124 B         102 kB
├ ƒ /api/portals/[portalId]/experiences                        124 B         102 kB
├ ○ /exports                                                   320 B         106 kB
├ ○ /icon.svg                                                    0 B            0 B
├ ○ /inventory                                               4.49 kB         110 kB
├ ○ /methodology                                               359 B         106 kB
├ ● /portals/[portalId]                                      3.64 kB         128 kB
├   ├ /portals/portal-agri-assam
├   ├ /portals/portal-agri-farmers-welfare
├   ├ /portals/portal-transport-assam
├   └ [+3 more paths]
├ ● /portals/[portalId]/share-experience                     4.63 kB         129 kB
├   ├ /portals/portal-agri-assam/share-experience
├   ├ /portals/portal-agri-farmers-welfare/share-experience
├   ├ /portals/portal-transport-assam/share-experience
├   └ [+3 more paths]
└ ○ /privacy                                                   347 B         103 kB

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

`apps/web/e2e/static-generation.spec.ts` re-verifies the static half at
the HTTP-header level on every CI run, so this stays a continuously
checked property rather than a one-time manual finding.

Re-run this exact procedure whenever a change to `apps/web`'s routing,
data-fetching, or the build pipeline (`apps/web/scripts/build-exports.ts`,
`next.config.mjs`) is suspected of affecting which routes are static.
