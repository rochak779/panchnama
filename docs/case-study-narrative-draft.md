# Case-study narrative — draft (Session 21 prep)

**Status: partial draft, prepared ahead of Session 21.** This covers only
the sections of implementation.md §14 Session 21's narrative
("context → blind spot → bounded approach → product → evidence →
learning → limitations → next hypothesis") that do not depend on
Session 17/18's real, published dataset. Sections that do are explicitly
marked `BLOCKED` below, not filled with fixture data dressed up as real
findings. Session 21 itself still needs to: write the blocked sections
once real data exists, produce diagrams/screenshots, and finalize the
demo scripts.

---

## 1. Context

State governments run web estates the way most large organizations
accumulate infrastructure: one department, one board, one scheme, one
vendor at a time, over years, with no single owner of the *collection*.
Each individual site may have been reasonably built for its own purpose.
Nobody owns the question of what the estate looks like as a whole —
which sites are still live, which are duplicates, which quietly stopped
working months ago and nobody noticed because nobody was watching all of
them at once.

This is not a problem unique to Assam, or to India. NSW, Australia
found itself managing roughly 750 government websites before a 2020
consolidation push — Minister Victor Dominello put it plainly: "We are
declaring war on unnecessary NSW government websites," estimating "at
least two thirds" were outdated and consolidatable ([iTnews,
2020](https://www.itnews.com.au/news/nsw-to-consolidate-500-government-websites-537465)).
The UK government ran "over 2,500 public websites" before 2011, with
"inconsistency" as the only thing they had in common
([Economics Observatory](https://www.economicsobservatory.com/the-uk-governments-digital-transformation-how-did-it-come-about)).
Both are cited here only for scale and precedent — see §5 below for what
they do and don't establish.

## 2. The blind spot

The common failure mode isn't that governments don't know they have a
website sprawl problem. It's that *nobody has an inspectable, dated,
reproducible answer* to basic questions about the estate as it actually
behaves right now: Which listed portals are actually reachable today?
Which official links lead citizens to broken destinations? Which
portals show credible signs of having gone stale? Which two portals
appear to do the same job, and does anyone plan to reconcile that?

Without a bounded, evidence-backed answer to those questions, "improve
the web estate" collapses into two equally weak moves: doing nothing
(because no one can point at a specific, defensible list of what's
broken), or jumping straight to a large redesign/consolidation
initiative based on impression rather than evidence ("at least two
thirds... outdated" is a real, useful political signal, but it is not
itself an inspectable, per-site accounting of *why*). Neither move is
wrong on its face — but both skip a step: actually looking, in a way
someone else could check.

## 3. The bounded approach (thesis)

**Government cannot improve, consolidate, or retire a web estate it
cannot see. A bounded, reproducible diagnostic is the credible first
step before consolidation or redesign.**

"Bounded" is doing real work in that sentence, and the product is built
to keep the promise:

- **Observed estate, not claimed completeness.** Every portal in scope
  has documented discovery provenance — where it was found, when, and
  through what route. The product never claims to be the complete legal
  inventory of a government's systems, only an honestly-scoped,
  dated sample of what was discoverable through named official sources.
- **Evidence before judgment.** Every published finding cites a URL, an
  observation, a timestamp, and the specific rule that produced it — not
  a composite "health score" standing in for a dozen unrelated checks.
- **Uncertainty is a legitimate answer.** "Not assessable" and "review
  required" are real, published outcomes, not failure states the product
  hides. A portal blocked by anti-automation defenses is reported as
  exactly that — not silently marked broken, not silently skipped.
- **Automation collects evidence; people make policy judgments.** The
  system can flag that two portals look functionally redundant. It
  cannot and does not decide that a government service should be
  retired — that stays a human, accountable decision, informed by the
  evidence rather than replaced by it.
- **A snapshot that can be rerun**, not a live monitoring claim. Every
  published run carries its own audit date and methodology version, so
  "as of when" is never ambiguous.

## 4. The product

Panchnama is a repeatable public audit that shows which government
websites in an observed estate need attention, why each one was
flagged, and what should happen next — with dated, inspectable evidence
behind every claim. It automates the parts that are genuinely
observable (reachability, broken links, TLS problems, staleness signals,
directory-listing mismatches, possible functional overlap) and routes
everything else to explicit human review rather than guessing. A
citizen-facing layer lets anyone who has actually used a listed portal
submit a structured account of that experience — kept clearly separate
from, and never automatically altered by, the technical audit findings.

The Assam pilot is the first application of this approach: a real,
bounded audit of a real observed estate, not a demo built on synthetic
data.

## 5. International precedent — what it does and doesn't establish

Both NSW and GOV.UK are cited here for one narrow purpose per
implementation.md §13.4: NSW to support the *scale and inevitability* of
the fragmentation problem this product addresses; GOV.UK to show what a
completed, national-scale consolidation looks like once undertaken — and
explicitly to draw a contrast with what this product is *not* attempting.

**NSW, Australia.** Roughly 750 government websites existed before the
2020 consolidation effort into `nsw.gov.au` / `service.nsw.gov.au`
(the "single front door" for services), with the responsible minister
targeting "more than 500" for retirement or merger and estimating "at
least two thirds" of the estate as outdated
([iTnews, 2020](https://www.itnews.com.au/news/nsw-to-consolidate-500-government-websites-537465)).
**What this does not establish:** NSW's own public materials describe a
phased rollout driven by ministerial direction and department-by-department
cooperation, not a published, per-site, evidence-backed diagnostic
preceding the consolidation decision. This case study does not claim NSW
proved "diagnose first" as a methodology — it uses NSW's scale as
evidence that the underlying fragmentation problem is real and large,
which is a different, narrower claim.

**GOV.UK.** Before 2011, the UK central government ran "over 2,500
public websites"
([Economics Observatory](https://www.economicsobservatory.com/the-uk-governments-digital-transformation-how-did-it-come-about)).
The Government Digital Service, formed in 2011, consolidated content
from 312 agencies and government organizations onto the single GOV.UK
domain, closing 685 legacy website domains and subdomains and setting up
over 1.8 million redirects, within roughly 15 months of full rollout
([Inside GOV.UK, the GDS's own blog, Dec
2014](https://insidegovuk.blog.gov.uk/2014/12/19/300-websites-to-just-1-in-15-months/)).
**Why it's kept brief, and why it's a contrast, not a template:** GOV.UK
was a national-government platform rebuild backed by a dedicated,
mandated digital service with authority over hundreds of agencies —
categorically different in scale, mandate, and resourcing from a
state-level diagnostic prototype like this one. Citing it as "the
answer" for Assam would misrepresent both the maturity of what this
product is and the institutional machinery GOV.UK's consolidation
actually required. It's cited here only to establish that estate-wide
fragmentation at this scale is a solvable, precedented problem — not as
a claim that Panchnama is a step toward a GOV.UK-scale rebuild.

## 6. Hero demonstration path — `BLOCKED`

implementation.md §14 Session 21 specifies: *official source → listed
portal → observed failure → citizen impact → finding → suggested
action*. This needs a real, reviewed finding from Session 18's published
dataset — walking through this path with fixture data would present
invented findings as if they were real evidence, which the product's own
first principle ("evidence before judgment") exists to prevent. Fill in
once Session 18 publishes.

## 7. Evidence, learning, limitations, next hypothesis — `BLOCKED`

All four of these sections are explicitly about *what the real audit
found* — they cannot be honestly written against fixture data. Session
21 writes these once Session 17/18 produce the real, reviewed Assam
dataset.

## 8. Demo script skeleton

Structure only — placeholder markers show exactly what Session 21 needs
to fill in once real data exists. Do not fill these with fixture-data
examples; leave them as marked placeholders until real findings exist.

### 5-minute demo script

1. **Open on the problem** (30s) — state the blind spot (§2 above) in
   one or two sentences. No product on screen yet.
2. **Show the observed estate** (60s) — the homepage/overview: portal
   count, technical-health breakdown, priority findings list. Emphasize
   "observed," not "complete."
3. **Walk the hero path** (90s) — `[PLACEHOLDER: real hero portal once
Session 18 publishes]` — official source → portal → observed failure →
   evidence → finding → suggested action, per §6 above.
4. **Show the evidence, not just the verdict** (60s) — click into the
   finding's evidence: URL, timestamp, the specific check that fired.
   Make the "you can check this yourself" property visible, not asserted.
5. **Close on the boundary** (30s) — what this is (a bounded diagnostic)
   and isn't (a live monitor, a complete inventory, a policy decision) —
   drawn from §3's bounded-approach principles.

### Extended demo script (additional beats, ~15 min total)

- Show a `not_assessable` portal and explain why that's an honest
  outcome, not a failure of the product.
- Show a `possible_overlap` finding and explicitly contrast it with a
  confirmed technical failure — the distinction implementation.md §13.3's
  usability task 3 tests for.
- Show the methodology page and an export file — the "audit date,
  methodology version, limitations" transparency implementation.md §10.7
  requires.
- Show the citizen-experience submission flow and explain the privacy/
  moderation model, and why it's kept visually and structurally separate
  from technical findings.
- `[PLACEHOLDER: 1-2 more real findings from the published dataset,
  chosen to show range — e.g. a critical availability failure and a
  directory-mismatch finding]`.
- Brief NSW/GOV.UK precedent beat (§5 above), explicitly framed as scale
  evidence and contrast, not endorsement.
- Close with the "next hypothesis" section once §7 is written.

## 9. What Session 21 still needs to do

- Fill in §6 and §7 once Session 18 publishes the real dataset.
- Produce diagrams/screenshots (implementation.md §14) — needs the real
  product UI showing real (or clearly-labeled stable demo) data.
- Add a stable demo dataset/run if live sites change before a
  presentation, "clearly labeled with its audit date" per the session
  brief — this should be the real Session 18 publication, snapshotted,
  not a second fixture set.
- Replace the `[PLACEHOLDER: ...]` markers above with real content.
- Cite every external factual claim used elsewhere in the final
  narrative the same way §5 does here (source, quote, precise number) —
  the two citations above are a template for the rigor the rest of the
  narrative should match.
