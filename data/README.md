# data/

Generated and curated audit data (implementation.md section 4.3):

- `seed/` — manually curated source inputs
- `raw/` — generated raw crawl data; git-ignored (mostly), kept only as a
  `.gitkeep` placeholder here
- `evidence/` — selected publishable evidence artifacts; git-ignored except
  for the `.gitkeep` placeholder, since real evidence requires the privacy
  review described in implementation.md section 5.8 before it is committed
- `review/` — human review decisions
- `published/` — validated static datasets consumed by the web app
- `fixtures/` — deterministic test websites/data

**Status:** directory scaffold only, empty until Sessions 1–3 (schemas,
config, and inventory ingestion) and later.
