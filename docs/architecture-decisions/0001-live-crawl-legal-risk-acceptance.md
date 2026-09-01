# ADR 0001: Live-crawl legal-risk acceptance for Session 17

- **Status:** accepted
- **Date:** 2026-09-01
- **Session:** Session 17 — Assam source research and controlled pilot crawl

## Context

Sessions 1–16 built and tested the audit pipeline entirely against
fixture/seed data (`data/seed/*`, `.example` domains). Session 17 is the
first session that sends real automated `GET` requests from
`@panchnama/audit-cli`'s crawler to live `.gov.in`/`assam.gov.in` hosts.

implementation.md §12.1–§12.3 establish *ethical* conduct for that crawler
(robots.txt respected, no auth bypass, no vulnerability scanning,
publication review, visible disclaimer). Those sections do not establish
*legal* authorization, and §12.5 requires this ADR, a target-host
register, and a documented sign-off before the first such request is
sent.

Panchnama is an unaffiliated party running an automated crawler against
Government of Assam infrastructure. Even a polite, read-only,
robots-respecting crawler can carry legal exposure — terms-of-use
violations, ambiguity under India's IT Act or related computer-misuse
provisions, or departmental objection after the fact — that ethical care
alone does not resolve.

## Decision

Proceed with the Session 17 smoke crawl (3–5 portals, per
implementation.md §14 Session 17) under the following narrow, explicitly
bounded profile, and accept the associated legal risk as the case-study
author rather than obtaining qualified Indian legal review beforehand:

- **Only** unauthenticated, publicly reachable pages are requested, via
  ordinary `GET` (optionally `HEAD`) — never `POST`, never form
  submission, never any route requiring login (`config/crawl-policy.yaml`
  `exclusions.routeCategories`).
- Politeness stays at or below a standard search-engine crawler:
  max 2 concurrent requests per host, minimum 750 ms delay per host, max
  40 pages per portal, max depth 2, max 3 retries with backoff — all
  already enforced by `config/crawl-policy.yaml`'s `boundaries`, not
  aspirational.
- `robotsAndIdentification.respectRobotsTxt: true` is enforced in
  config; any host whose robots.txt disallows crawling is excluded
  rather than bypassed (§6.3).
- The global kill switch (`safeOperation.globalKillSwitch`) and
  per-domain disable list (`safeOperation.disabledDomains`) — both
  already implemented in `packages/audit-core` (`crawl-scope.ts`,
  `browser-eligibility.ts`) — are rehearsed and ready before the first
  live request; Rochak Agarwal (rochak.ag779@gmail.com) can invoke
  either immediately if a department objects or unexpected impact is
  observed.
- Scope is limited to the hosts recorded in
  `docs/target-host-register.md` at the time of each run; new hosts
  discovered during curation are added to that register with an
  include/exclude decision before being crawled, not crawled first and
  recorded after.
- This authorization covers **only** the bounded 3–5 portal smoke crawl.
  The estate-wide run requires a separate, later sign-off per §12.5's
  own requirement, made after reviewing the smoke crawl's logs, target
  responses, objections, and safety behavior.

**Known gap, explicitly accepted rather than fixed for this pilot:**
`config/crawl-policy.yaml`'s `robotsAndIdentification.userAgent` and
`contactUrl` are still placeholder `panchnama.example.org` values, not a
real, monitored contact route a department could use to reach the crawl
operator, which §6.3 calls for once deployed against live hosts. This is
judged acceptable at the pilot's low request volume and narrow scope, but
is **not** acceptable to carry into any wider or repeated live crawling.
Tracked as a required fix in implementation.md §18.1 before any run
beyond this smoke crawl.

## Risk acceptance / sign-off

I, Rochak Agarwal (rochak.ag779@gmail.com), as the case-study author, have
reviewed the profile above and accept the legal risk of sending the
Session 17 smoke crawl's requests to the live hosts recorded in
`docs/target-host-register.md`, on the basis that they are ordinary
low-volume public `GET` requests where neither the relevant terms of use
nor Indian law, as I understand them, creates identified ambiguity for
this activity. I have not obtained qualified Indian legal review of this
decision. If a target host's terms are found to prohibit automation, or
authorization becomes uncertain during curation, that host is excluded
per the register rather than crawled on this authorization.

— Recorded 2026-09-01.

## Alternatives considered

- **No live crawl; keep the case study fixture-only.** Rejected — the
  product's core claim (a real, evidence-backed Assam estate audit)
  cannot be substantiated without real data, and implementation.md
  §14 Session 17 already scopes this as required, bounded work.
- **Obtain qualified Indian legal review before any request.** More
  conservative, but disproportionate for a narrow, unauthenticated,
  low-volume public-page crawl at prototype stage; §12.5 explicitly
  allows author risk-acceptance for this profile and reserves legal
  review for cases where terms or law create identified ambiguity.
- **Fix the User-Agent contact-route gap before proceeding.** Rejected
  for the pilot specifically (low volume, narrow scope, short-lived);
  required before wider use — see §18.1.

## Consequences

- Unblocks Session 17's source-verification and 3–5 portal smoke crawl.
- The estate-wide run remains blocked pending a second, separate
  sign-off reviewing the smoke crawl's actual behavior (§12.5).
- Any wider or repeated live crawling beyond this smoke crawl is blocked
  until the User-Agent/contact-route gap (implementation.md §18.1) is
  fixed.
- `docs/target-host-register.md` becomes the authoritative record of
  which hosts this authorization covers; it must be updated before any
  new host is crawled.

## References

- implementation.md sections: §6 (crawl policy), §12.5 (legal-risk and
  live-crawl approval gate), §14 Session 17, §18.1 (deferred operational
  gaps)
- `docs/target-host-register.md`
- `config/crawl-policy.yaml`
- Related ADRs: none yet
