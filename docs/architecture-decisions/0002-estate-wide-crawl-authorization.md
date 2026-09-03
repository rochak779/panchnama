# ADR 0002: Estate-wide live-crawl authorization for Session 17

- **Status:** accepted
- **Date:** 2026-09-03
- **Session:** Session 17 — Assam source research and controlled pilot crawl (resumed)

## Context

ADR 0001 authorized only the Session 17 smoke crawl (3–5 portals) and
explicitly reserved the estate-wide run for a separate, later sign-off
"made after reviewing the smoke crawl's logs, target responses,
objections, and safety behavior" (implementation.md §12.5). The smoke
crawl (5 portals: `animalhusbandry.assam.gov.in`, `dgcd.assam.gov.in`,
`police.assam.gov.in`, `itiassam.admissions.nic.in`, `www.aegcl.co.in`)
ran cleanly with no objections observed. This session resumes Session 17
to produce the real, dated raw run its exit criteria require, which means
crawling the full real 177-portal inventory
(`data/raw/inventory/assam-20260903T104708Z`), not just the smoke sample.

## Decision

Proceed with a bounded estate-wide crawl of all 177 portals in the real
inventory, under the same technical profile as ADR 0001 (unauthenticated
`GET`/`HEAD` only, `config/crawl-policy.yaml` boundaries unchanged: ≤40
pages/portal, depth 2, 2 concurrent requests/host, 750 ms delay/host,
robots.txt respected live by the crawler at request time), with these
differences from the smoke crawl:

- **Scope: all 177 portals**, not a 3–5 portal sample.
- **Terms-of-use review: batch spot-check, not per-host.** Given 177
  hosts, individually reviewing each host's terms of use was judged
  disproportionate for a prototype case study (same reasoning ADR 0001
  used for skipping qualified legal review) — the profile relies on the
  same reasoning as ADR 0001's own risk acceptance (ordinary public
  `.gov.in`/`.nic.in`/`.ac.in`/similar informational sites, unauthenticated
  `GET` only), not an individually-verified terms-of-use finding per
  host. `docs/target-host-register.md`'s per-host rows remain the record
  for the hosts individually reviewed so far (the original 6 seed/smoke
  hosts); it is not being expanded to 177 individual rows this session.
- **Unreachable/geoblocked hosts: attempted normally, not pre-excluded.**
  A pre-crawl reachability sweep
  (`data/raw/reachability/assam-20260903T104708Z-sweep.json`, gitignored)
  found 91 of 177 hostnames unreachable (mostly `CONNECT_TIMEOUT`) from
  this development environment. The original plan was to add these to
  `config/crawl-policy.yaml`'s `safeOperation.disabledDomains` to skip
  them outright. That was reverted after inspecting
  `packages/audit-core/src/rules/availability.ts` and
  `technical-health.ts`: a `disabledDomains` skip produces zero
  `PageObservation`s and only an advisory `crawl_coverage` finding, which
  derives `technicalHealth: "healthy"` — the opposite of the intended
  outcome for a portal that was never actually checked. Instead, all 177
  portals are crawled normally; a host that is genuinely unreachable will
  fail its real `maxAttemptsAvailabilityCritical` (3) retries and
  correctly surface as `availability.unavailable.v1`
  (`technicalHealth: "unavailable"`), the rule engine's designed
  behavior for "entry point could not be reached across the configured
  attempts" — not `not_assessable`, which is reserved for
  automation-blocked/access-restricted (403/CAPTCHA) signals per
  `NOT_ASSESSABLE_RULE_IDS`. No Indian-hosted crawl infrastructure is
  provisioned this session; the reachability sweep and this decision only
  avoid a stale/incorrect pre-exclusion, not the underlying constraint
  that this environment cannot reach geoblocked hosts.
- **Sign-off:** given in conversation by Rochak Agarwal
  (rochak.ag779@gmail.com), the case-study author, after being presented
  with the profile above and an explanation of the underlying legal risk
  (no government authorization obtained; IT Act unauthorized-access
  exposure judged low but not legally reviewed; possible undiscovered
  terms-of-use restrictions on some of the 177 hosts; greater visibility
  than the 5-host smoke crawl). Same risk-acceptance basis as ADR 0001:
  author risk acceptance for ordinary low-volume public `GET` requests,
  not qualified Indian legal review.

## Alternatives considered

- **Individually review terms-of-use/robots for all 177 hosts before
  crawling.** More rigorous, but a multi-day effort disproportionate to
  a prototype case study; rejected for the same reason ADR 0001 didn't
  seek legal review — offered to the user as an explicit option and not
  chosen.
- **Provision Indian-hosted crawl infrastructure to reach geoblocked
  hosts.** Rejected as scope creep for this session; `not_assessable`/
  `unavailable` are legitimate, honest published outcomes for a host this
  environment cannot reach.
- **Keep the `disabledDomains` pre-exclusion.** Rejected after tracing
  its actual effect through the rule engine — see Decision above. This
  was the original plan communicated to the user; corrected before
  running the real crawl once the mechanism was understood.

## Consequences

- Unblocks the full-inventory crawl this session runs against.
- Portals unreachable from this environment will publish as
  `technicalHealth: "unavailable"` (or, if the real failure mode turns
  out to be a 403/CAPTCHA rather than a connection failure,
  `not_assessable`) with `pending_review` findings — Session 18 must
  still human-review these before publication, same as any other
  candidate finding; this ADR does not pre-decide their final published
  status.
- Any live crawl broader than this run (e.g., a future re-crawl, a wider
  geography) needs its own fresh sign-off per §12.5 — this ADR covers
  only this dated run against this inventory build.
- The User-Agent/contact-route gap noted in ADR 0001 (still placeholder
  `panchnama.example.org` values) remains outstanding and is now carried
  across 177 hosts instead of 5; unchanged risk acceptance, larger
  surface — tracked in implementation.md §18.1, not fixed by this ADR.

## References

- implementation.md sections: §6 (crawl policy), §12.5 (legal-risk and
  live-crawl approval gate), §14 Session 17/18
- `docs/architecture-decisions/0001-live-crawl-legal-risk-acceptance.md`
- `docs/target-host-register.md`
- `data/raw/reachability/assam-20260903T104708Z-sweep.json` (gitignored,
  reproducible via the sweep script recorded in `docs/session-log.md`)
- `packages/audit-core/src/rules/availability.ts`,
  `packages/audit-core/src/technical-health.ts`
- Related ADRs: supersedes ADR 0001's estate-wide-run restriction (ADR
  0001's smoke-crawl authorization itself remains in force/historical)
