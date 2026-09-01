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
| `assam.gov.in` | Not yet reviewed | Not yet checked | Smoke crawl: ≤40 pages, depth 2, per `config/crawl-policy.yaml` | Government of Assam (no specific contact identified yet) | **pending** — do not crawl until reviewed | State portal; source of `assam-gov-portal` and `assam-district-portal-directory` (`/districts`) in `config/sources.assam.yaml` |
| `online.assam.gov.in` | Not yet reviewed | Not yet checked | Smoke crawl: ≤40 pages, depth 2, per `config/crawl-policy.yaml` | Government of Assam (no specific contact identified yet) | **pending** — do not crawl until reviewed | Citizen e-services directory; source of `assam-online-services` in `config/sources.assam.yaml` |

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
