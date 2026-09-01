# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a state web-governance/IT audit team (e.g. Assam government officials
or their advisors) trying to understand and improve the state's government
web estate — which portals exist, which are broken, and what to fix first.
Secondary: the public and researchers, who can inspect the same published
evidence and anonymously submit a structured account of using a listed
portal. The experience feature is research evidence for this audience, not a
grievance-resolution channel. [Inferred from implementation.md sections 1.3,
2.1 — not independently interviewed; confirmed by the user as an accurate
reading of the existing spec.]

## Product Purpose

Panchnama is a repeatable, evidence-backed public audit that shows which
Assam government websites need attention, why they were flagged, and what
should happen next, with dated evidence anyone can inspect. It does not
claim to establish the complete legal inventory of government systems — it
audits an explicitly bounded "observed web estate" assembled from named
official sources. [implementation.md section 1.1-1.2, 1.5]

## Positioning

Not a monitoring service, not a grievance/complaint system, not a government
CMS, and not a composite "score." Its distinguishing mechanism: every
published finding cites a URL, an observation, a timestamp, and an audit
rule (evidence before judgment) — `Not assessable` and `Review required` are
legitimate, visible outcomes rather than being smoothed into a single
number. Citizen-reported experience is displayed and aggregated separately
from technical findings and never automatically changes an audit verdict.
[implementation.md section 1.6]

## Operating Context

A dated, rerun-able audit pipeline (crawl → analyze → human review →
publish) produces static JSON/CSV output that this web app reads at build
time; there is no live monitoring. A small server-side API (Sessions 9-10,
already built) accepts anonymous citizen-experience submissions into
PostgreSQL, holds them for CLI-driven human moderation, and serves back only
approved/redacted experiences. The product is explicitly independent and
non-official — it must never visually or textually imply endorsement by, or
affiliation with, the Government of Assam. [implementation.md sections 1.6
principle 8, 4, 9, 10.10]

## Capabilities and Constraints

- Framework/stack already decided in Session 0 (not this session's
  decision): Next.js 15 App Router, TypeScript, static generation for the
  audit scorecard pages reading validated local published-data fixtures at
  build time; a small Node.js-runtime server API for the experience
  feature. [implementation.md section 4.1; apps/web as scaffolded]
- No user accounts, sign-in, or profiles anywhere in the product (audit
  side or experience side).
- No composite/vanity score, state ranking, or unsupported "money saved"
  estimate — technical health, severity, and suggested action are always
  shown as distinct fields, never blended into one number.
- Must meet WCAG 2.2 AA where feasible: full keyboard navigation and
  visible focus, semantic headings/landmarks/tables, status **never**
  communicated by color alone, respect for reduced-motion preference, no
  horizontal page overflow at 320px width. [implementation.md section
  10.9 — hard constraint, confirmed by the user]
- Citizen-experience data must stay visually and structurally separate from
  technical audit findings on every page that shows both (portal detail).
- No iframe/embed of any government portal.
- Language: English-only UI in v1 (a known, explicitly stated limitation,
  not a silent gap — implementation.md section 2.2).

## Evidence on Hand

No real Assam audit data exists in this repository yet (real inventory/
crawl/review data is Session 17+'s job). Sessions 0-9 produced schemas,
config, a crawler, deterministic audit rules, a review/publish pipeline, and
a citizen-experience database + API — all exercised so far only against
fixture/test data. Session 11 must build against **validated local
published-data fixtures**, not real content, and must not fabricate Assam
government names, portals, or findings as if real.

## Product Principles

1. Evidence before judgment — every finding traces to a URL, observation,
   timestamp, and rule; every page answering "why" links to that evidence.
2. No false precision — never collapse unrelated checks into one score;
   show technical health, severity, and suggested action as distinct,
   separately-explained fields.
3. Uncertainty is visible, not hidden — `Not assessable` and partial-audit
   states are first-class, designed states, not edge cases skipped in
   design.
4. Independent and non-official by construction — every page carries the
   disclaimer; the visual language must read as a case-study registry, not
   a government portal, at a glance.
5. Citizen experience informs but never adjudicates — always shown
   separately from, and never merged into, technical audit verdicts.

## Accessibility & Inclusion

WCAG 2.2 AA where feasible is a stated product requirement, not aspirational
polish (implementation.md section 10.9): full keyboard support and visible
focus; status conveyed by icon/text/pattern in addition to color; adjacent
text/table equivalents for any chart; 320px minimum width without page-level
horizontal scroll (wide tables get their own labeled scroll container or a
card transformation instead).
