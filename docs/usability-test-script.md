# Usability test script (Session 20 prep)

This is the neutral test script and participant-recruiting plan for
Session 20 ("Usability test and refinement"), prepared per
implementation.md section 14's instruction to "prepare a neutral test
script using the tasks in section 13.3." It is **prep only** — no test has
been run yet. Running it requires real participants, which is Session 20's
own job, not something this preparation does on its own.

**Data note:** as of this writing, Session 17 (real Assam crawl) has not
yet produced the reviewed, published dataset Session 18 will build. Until
then, run this script against the existing fixture data
(`data/fixtures/`) the same way every other page in the product currently
does — the six fixture portals already cover a healthy failure, a critical
failure, a possible-overlap case, a not-assessable case, and two healthy/
distinct cases (see `docs/session-log.md`'s Session 11 entry for the full
fixture roster), which is enough variety to exercise all 5 tasks below.
**Before running this with real participants against real data**, re-check
that the task-specific portal names/details below still match whatever
Session 18 ultimately publishes — swap them if they don't, but keep the
task wording and observation criteria unchanged.

## Who to recruit

Per implementation.md section 13.2, in order of preference:

1. **Government technologists** — people who have built or maintained
   public-sector digital services.
2. **Former public-sector staff** — especially anyone who has worked
   inside a department that owns/operates public-facing web portals.
3. **Civic-tech practitioners** — people working on open-government,
   transparency, or civic-technology projects.
4. **People managing large web estates** — even outside government (e.g.
   enterprise IT, university web governance) — the "many portals, unclear
   ownership, inconsistent upkeep" problem generalizes.

**Target: 3–5 participants** (implementation.md section 14's stated
range). If none of the above are reachable in time, use **informed
proxies** instead — people briefed on the domain who are not literally
government/civic-tech practitioners — but this is a real limitation, not
a substitute of equal quality, and must be labeled as such in whatever
Session 20 writes up (implementation.md section 13.2's explicit
instruction).

## Session format

- **Individual sessions**, not a group — one participant at a time, so
  one person's answer doesn't anchor another's.
- **Think-aloud protocol**: ask the participant to narrate what they're
  looking at and why as they work, not just their final answer.
- **Screen recording or live note-taking** — capture what they clicked,
  what they read, where they hesitated, not just whether they succeeded.
- **Neutral facilitation is the whole point of this document existing.**
  Do not confirm, hint, or correct mid-task. If a participant asks "is
  this the right page?", the honest facilitator answer is some version of
  "use your own judgment, there's no wrong place to look" — not a nod or
  headshake. Implementation.md section 13.3 is explicit: "do not lead the
  participant."
- **Timebox**: give each task a generous but bounded window (a working
  suggestion: 5 minutes per task, 10 for Task 3 which has two sub-parts)
  before moving on, recording it as "did not complete" rather than letting
  one task consume the whole session.

## Pre-task script (read to every participant, verbatim)

> "Thanks for helping test this. You're looking at a prototype scorecard
> that tracks the health of Assam government web portals — things like
> whether a site is reachable, whether it duplicates another department's
> content, and what should happen next. I'm going to give you five small
> tasks. Please think out loud as you go — tell me what you're looking at
> and why, even if you're not sure. There are no wrong answers and you're
> not being tested — I'm testing whether the product makes sense, not
> you. I won't be able to help or hint during a task, but ask me anything
> before we start or between tasks."

## The 5 tasks (implementation.md section 13.3, verbatim)

For each task: give the participant only the bolded prompt (read exactly
as written, no elaboration), then silently observe. After each task,
record the 4 things listed below it before moving to the next task.

### Task 1 — Identify the three portals that need attention first

**Prompt to read aloud:** "Using this scorecard, tell me which three
portals need attention first, in order."

**What "success" looks like:** the participant lands on the homepage's
"Priority findings" section (or navigates there) and names portals in an
order that's consistent with severity (critical before significant before
advisory) — they do not need to know the underlying algorithm, just reach
a defensible top-3 by whatever path they use.

**Record:**
- Completion: did they name three portals, in a defensible priority
  order, without help? (yes / partial / no)
- Time: seconds from prompt to their final answer.
- Errors: any wrong turns (e.g. went to `/inventory` and tried to manually
  rank health badges instead of finding the priority list; picked portals
  that aren't actually the top 3 by the page's own logic).
- Comprehension: did they articulate *why* their top 3 are top 3 (severity,
  recency), or just name portals without a stated reason?

### Task 2 — Explain why one portal was flagged

**Prompt to read aloud:** "Pick one of the portals you just named and
explain to me why it was flagged."

**What "success" looks like:** the participant reaches that portal's
detail page and reads out the actual finding title/summary text (not a
guess or a restatement of the technical-health label alone).

**Record:**
- Completion / Time / Errors (same definitions as Task 1).
- Comprehension: do they repeat the finding's real explanatory text, or
  do they infer/invent a reason not actually stated on the page? (This
  distinction is the whole point of the task — inventing a plausible-
  sounding reason that isn't what the page says is a comprehension
  failure worth recording even if the participant sounds confident.)

### Task 3 — Distinguish a confirmed failure from a possible overlap

**Prompt to read aloud:** "Find one portal that has a confirmed technical
failure, and a different portal that has a *possible* overlap with
another portal. Tell me how you can tell the difference between the two."

**What "success" looks like:** the participant can point to distinct
visual/textual signals (e.g. "Unavailable" badge + a category like
"availability" for the confirmed case, vs. "possible_overlap" wording and
hedged language like "possible" for the inferred case) and can state in
their own words that one is directly observed and the other is a
judgment call, not two flavors of the same kind of claim.

**Record:**
- Completion / Time / Errors.
- Comprehension: this is the task most directly testing
  implementation.md section 1.6's "evidence before judgment" principle —
  record verbatim (or close to verbatim) how the participant describes
  the difference. A participant who says "one's worse than the other" has
  not grasped the distinction being tested; a participant who says
  "one's something the audit actually observed happening, the other is
  someone's inference/suspicion" has.

### Task 4 — Find where the portal was identified as official

**Prompt to read aloud:** "For the portal you just looked at, find where
it says how we know this is an official government portal."

**What "success" looks like:** the participant locates the portal's
"Official status" field and/or its source/provenance text (e.g. "Source:
inventory record ...") on the detail page, without confusing it with an
unrelated field (technical health, suggested action, etc.).

**Record:**
- Completion / Time / Errors.
- Comprehension: do they understand "official status" as a provenance/
  trust claim distinct from "is this site currently working"? A
  participant who answers with the technical-health badge has conflated
  two different questions — record that explicitly.

### Task 5 — State the recommended next action and its limitation

**Prompt to read aloud:** "For that same portal, what does the scorecard
recommend happens next — and what does it say might limit how much you
should trust that recommendation?"

**What "success" looks like:** the participant states the suggested
action (e.g. "Repair," "Review: possible consolidation") AND locates a
stated limitation (e.g. a finding's `limitations` text, a coverage note,
or a not-assessable explanation) — both halves, not just the action.

**Record:**
- Completion / Time / Errors.
- Comprehension: do they treat the suggested action as a directive
  ("so they should fix it") or as advisory ("this is what the evidence
  suggests, with this caveat")? Section 13.3's whole framing is that
  users should understand suggested actions come with stated limits, not
  as unconditional instructions — record which framing the participant
  lands on.

## After all 5 tasks: closing questions (open-ended, not leading)

Ask these only after every task is done, so answers here don't prime task
behavior:

- "What would make you trust — or not trust — a finding on this site?"
- "Was anything confusing or surprising as you went through these tasks?"
- "If you were the person responsible for one of these portals, what
  would you want to see that isn't here?"

## After the session: issue log template

For each observed problem (not just failures — anything that caused
hesitation, a wrong turn, or a misreading), log:

| Field | What to record |
|---|---|
| Task | Which of the 5 tasks (or the closing questions) |
| Participant | Anonymized id (P1-P5), not a name |
| Observation | What happened, in the participant's own words where possible |
| Task impact | Did it prevent task completion, slow it down, or just cause momentary confusion? |
| Suspected cause | Your best read of *why* (a UI/copy issue, a genuine conceptual gap, a one-off) — mark clearly as a hypothesis, not a confirmed cause, until it recurs across participants |

Once all participants are run, **rank issues by task impact first, then
frequency** (an issue that blocked 2 of 5 participants on Task 1 outranks
one that mildly confused 1 of 5 participants on a closing question) —
this ordering is what implementation.md section 14 asks Session 20 to fix
first ("rank issues by task impact and frequency," "fix the highest-
impact comprehension/navigation problems").

## What Session 20 still has to do (not done by this prep)

- Actually recruit and run 3–5 sessions.
- Fill in the issue log with real observations.
- Fix the highest-impact problems and re-run only the affected tasks
  (not a full re-test) to confirm the fix worked.
- Write up validated findings and any remaining assumptions (e.g. "we
  only tested with informed proxies, not real government technologists")
  in `docs/session-log.md`'s Session 20 entry, per implementation.md
  section 14's exit criteria: "participants can distinguish observed
  failure from inferred review, identify priorities, find provenance, and
  understand suggested actions."
