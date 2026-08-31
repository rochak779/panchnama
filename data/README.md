# data/

Generated and curated audit data (implementation.md section 4.3):

- `seed/` — manually curated source inputs, including Session 3's
  illustrative fixture directory pages (`assam-directory-example.*`), the
  fixture-wiring map (`source-inputs.json`), and the manual alias list
  (`aliases.json`) — see `docs/session-log.md` "Session 3" for what's real
  vs. illustrative here
- `raw/` — generated raw crawl/ingestion data; git-ignored (mostly), kept
  only as a `.gitkeep` placeholder here. `raw/inventory/<runId>/` holds
  `pnpm run audit inventory:build --state assam` output (`portals.json`,
  `sources.json`, `candidates.json`, `report.md`); `raw/inventory/latest`
  points at the most recent run ID. This is pre-review, fixture-driven
  output — not the validated publication dataset (see Session 8)
- `evidence/` — selected publishable evidence artifacts; git-ignored except
  for the `.gitkeep` placeholder, since real evidence requires the privacy
  review described in implementation.md section 5.8 before it is committed
- `review/` — human review decisions
- `published/` — validated static datasets consumed by the web app
- `fixtures/` — deterministic test websites/data

**Status:** `seed/` now has real (illustrative fixture) content as of
Session 3; `raw/inventory/` is populated by running
`pnpm run audit inventory:build --state assam` (git-ignored, regenerate
locally). `evidence/`, `review/`, and `published/` remain empty until
later sessions.
