# Target-host register

Authoritative record of which live hosts Panchnama's automated crawler is
authorized to contact, and on what basis — required by implementation.md
§12.5 and referenced by
`docs/architecture-decisions/0001-live-crawl-legal-risk-acceptance.md`.

**Rule:** a host is added here, with a decision, *before* it is crawled —
never crawled first and recorded after. Any host not listed here, or
listed with `exclude`, must not be sent automated requests by
`@panchnama/audit-cli`.

This register currently covers only the hosts already declared in
`config/sources.assam.yaml` as seed inventory sources. Session 17's
curation work will add rows here (with terms-of-use/robots findings) for
every additional host discovered before it is admitted to a crawl.

| Host | Terms of use | Robots policy | Intended request volume | Owner / contact | Decision | Notes |
|---|---|---|---|---|---|---|
| `assam.gov.in` | Not yet reviewed | Not yet checked | Smoke crawl: ≤40 pages, depth 2, per `config/crawl-policy.yaml` | Government of Assam (no specific contact identified yet) | **pending** — do not crawl until reviewed | State portal; source of `assam-gov-portal` and `assam-district-portal-directory` (`/districts`, likely wrong path — see below) in `config/sources.assam.yaml`. **Reachability, 2026-09-01:** DNS resolves (`103.158.205.47`), but a multi-location check (check-host.net) timed out from every tested location, including India (Mumbai, Kolkata) — not just non-Indian ones. Looks like a genuine current outage/misconfiguration, not geoblocking. Needs a retry before drawing any audit conclusion. |
| `online.assam.gov.in` | Not yet reviewed | Not yet checked | n/a — likely wrong host | Government of Assam (no specific contact identified yet) | **pending, likely wrong** — do not crawl | Source of `assam-online-services` in `config/sources.assam.yaml`. Web search found no evidence this is a real, current domain; the actual citizen e-services portal appears to be `eservices.assam.gov.in` (see below), with `sewasetu.assam.gov.in` and `rtionline.assam.gov.in` as separate service-specific portals. `config/sources.assam.yaml` likely needs correcting to point at the right host(s) before this row can be resolved. |
| `eservices.assam.gov.in` | Not yet reviewed | Not yet checked | Not yet scoped — added pending correction of `config/sources.assam.yaml` | Government of Assam (no specific contact identified yet) | **pending** — do not crawl until reviewed | Candidate replacement for `online.assam.gov.in`, found via web search, not yet added to `config/sources.assam.yaml`. **Reachability, 2026-09-01:** confirmed geoblocked by source country — India-based nodes (Mumbai, Kolkata) get a real HTTP response (502 Bad Gateway, i.e. TCP connects and an app/gateway answers); a US node's connection times out at the network level, never completing a handshake. Any live crawl of this host will need to originate from Indian-hosted infrastructure, not from this development environment. |
| `assam.gov.in/districts` (path) | n/a | n/a | n/a | n/a | **pending, wrong path** | `config/sources.assam.yaml`'s `assam-district-portal-directory` source points at `assam.gov.in/districts`, which does not appear to be a real path. Web search suggests the real district-directory pages are `assam.gov.in/districts-page.html` and/or `gad.assam.gov.in/district-websites` (a different host, not yet added here). Needs re-verification once `assam.gov.in` is reachable again. |
| `igod.gov.in` | Not yet reviewed | Not yet checked | One-off directory fetch to build the candidate list, not a per-portal crawl | National Informatics Centre / MeitY (central government, not Assam's own) | **pending** — do not crawl until reviewed | Added to `config/sources.assam.yaml` (`assam-igod-directory`) in Session 17 as the new primary inventory-directory source, replacing the wrong `online.assam.gov.in` entry. **Reachability, 2026-09-03:** confirmed reachable from this development environment (DNS resolves, HTTP 200), independent of `assam.gov.in`'s own outage. `/sg/AS/categories` returned real, structured content (~38 named Assam department/district/agency links with real subdomains) — not a JS shell, plain HTTP fetch works. |
| `police.assam.gov.in`, `animalhusbandry.assam.gov.in`, `barpeta.assam.gov.in` | Not yet reviewed | Not yet checked | Not yet scoped | Government of Assam (department/district-specific, not yet identified individually) | **pending** — do not crawl until reviewed | Discovered via `igod.gov.in`. **Reachability, 2026-09-03:** all 3 returned HTTP 200 from this development environment. |
| `art.assam.gov.in`, `agri-horti.assam.gov.in`, `asdm.assam.gov.in` | Not yet reviewed | Not yet checked | Not yet scoped | Government of Assam (department-specific, not yet identified individually) | **pending** — do not crawl until reviewed | Discovered via `igod.gov.in`. **Reachability, 2026-09-03:** all 3 timed out from this development environment — same pattern as `eservices.assam.gov.in`/`assam.gov.in`, but note this is a roughly 50/50 split across the 6 hosts sampled, not a blanket estate-wide block. |

## Column definitions

- **Terms of use** — summary of the site's published terms regarding
  automated access, or "Not yet reviewed."
- **Robots policy** — what `robots.txt` allows/disallows for the paths
  this crawl would touch, or "Not yet checked."
- **Intended request volume** — the actual bound this host will be
  crawled under (should trace to `config/crawl-policy.yaml`'s
  `boundaries`, not exceed it).
- **Owner / contact** — a specific department/contact route if
  identifiable; otherwise say so plainly rather than guessing.
- **Decision** — `include`, `exclude`, or `pending`. Only `include` rows
  may be crawled, and only after terms/robots are actually reviewed
  (a `pending` row is not a green light).
- **Notes** — anything else relevant (e.g., why excluded, ambiguity
  found, link to evidence of terms/robots review).

## Changelog

- 2026-09-01 — Register created (Session 17 gate). Seeded with the two
  distinct hostnames from `config/sources.assam.yaml`'s 3 seed sources;
  no terms-of-use or robots.txt review has been performed yet — both
  rows are `pending` and must not be crawled until reviewed.
- 2026-09-01 — Reachability testing (WebFetch, Firecrawl, and Chrome
  browser automation all failed to load `assam.gov.in`; a multi-location
  check via check-host.net clarified why): `assam.gov.in` appears to be
  down/unreachable from everywhere right now, including India — not
  geoblocked. `eservices.assam.gov.in` (candidate replacement for the
  likely-wrong `online.assam.gov.in` seed entry) *is* geoblocked by
  source country: reachable from India, connection-timeout from the US.
  Also found that `config/sources.assam.yaml`'s `/districts` path is
  probably wrong. None of this changes any `pending` decision yet —
  robots.txt/terms still haven't been reviewed for any host — but it
  does mean the eventual live crawl needs to run from Indian-hosted
  infrastructure, and `config/sources.assam.yaml` needs corrections
  before the seed sources can be trusted. `assam.gov.in` needs a retry
  once it's back up.
- 2026-09-01 (later same day) — Retried `assam.gov.in` from India
  (Mumbai, Kolkata): still connection-timeout from both. Outage/
  unreachability persists; not yet resolved.
- 2026-09-03 (later same day) — Ran a full reachability sweep across
  all 177 real entities discovered via `igod.gov.in`'s 11 Assam category
  pages (not just the earlier 6-host sample): 88 reachable, 89
  unreachable from this development environment — settling the "is
  Assam data too thin" question with real numbers rather than a small
  sample. Enabled `assam-igod-directory` in `config/sources.assam.yaml`
  (was disabled pending this) and ran a real `inventory:build` against
  the curated 177-entry list — produced a genuine 177-portal dated run
  under `data/raw/inventory/` (gitignored, reproducible from the cited
  igod.gov.in pages, not committed — matches how every other raw run is
  handled). Fixed two small bugs surfaced by being the first real
  (non-`data/seed`) `inventory:build` caller: `InventorySource.
  evidencePath` was hardcoded to assume `data/seed/` regardless of the
  actual `--seed-dir` used, and warning/error messages had the same
  hardcoding; both now reflect the real seed directory given.
- 2026-09-03 — Found `igod.gov.in`, a central-government directory,
  reachable and returning a real structured list of Assam department/
  district sites. `config/sources.assam.yaml` updated: added
  `assam-igod-directory`, removed the wrong `assam-online-services`
  entry, corrected the district-directory path (still unverified by
  direct fetch, pending `assam.gov.in` recovery). Sampled 6 of the
  newly-discovered hosts: 3 reachable, 3 not — geoblocking/reachability
  issues affect a meaningful minority so far, not the whole estate.
