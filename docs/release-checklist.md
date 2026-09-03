# Release checklist

Formal sign-off gate for implementation.md §14 Session 19's exit
criteria ("all quality gates pass; no critical accessibility issue; no
broken core journey; release checklist is signed off in the session
log"). Re-run this checklist before any deploy; record the date and
result in `docs/session-log.md` each time.

## Automated gates (all must exit 0)

- [ ] `pnpm -r --workspace-concurrency=1 --filter "./packages/*" run build` (must run first — `packages/*` publish types/runtime from `dist/`, so lint/typecheck/test cannot resolve cross-package imports on a fresh checkout until this has run)
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test` (includes `apps/web/src/app/__tests__/no-raw-html.test.ts` and the long-content case in `PortalDetailContent.test.tsx`)
- [ ] `pnpm build`
- [ ] `pnpm --filter @panchnama/web run test:e2e` — runs every spec under `apps/web/e2e/`:
  - `smoke.spec.ts` — harness sanity
  - `task-flows.spec.ts` — implementation.md §13.3's 5 usability tasks
  - `accessibility.spec.ts` — axe scan + keyboard-traversal, all 7 routes
  - `responsive.spec.ts` — mobile/tablet/desktop viewports, 200% zoom, reduced motion
  - `static-generation.spec.ts` — audit pages remain statically generated
  - `links-and-exports.spec.ts` — same-origin link crawl, export download integrity
  - `disclaimers-and-versions.spec.ts` — independence disclaimer, official status, methodology version
- [ ] `pnpm --filter @panchnama/web run check:bundle-size` — every page within its First Load JS budget

## Manual/documented items

- [ ] `docs/clean-checkout-verification.md`'s procedure has been re-run since the last dependency or build-config change
- [ ] `docs/manual-keyboard-review.md` reviewed — its documented gaps (visual focus-ring perceivability, tab order sensibility, screen-reader behavior) are either accepted as known limitations or scheduled into Session 20's usability testing
- [ ] No critical or significant `jest-axe`/`axe-core` accessibility violation is open anywhere in the codebase (both the existing per-component `jest-axe` suite and this session's `accessibility.spec.ts`)

## Sign-off

Record in `docs/session-log.md`: date, who ran the checklist, which items
passed, and any item left unchecked with its reason.
