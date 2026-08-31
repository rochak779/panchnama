# AGENTS.md

Repository-specific rules for Codex/Claude-style coding agents working on
Panchnama. `implementation.md` is the authoritative specification — read it
in full before making changes. This file summarizes process rules; where
the two conflict, follow `implementation.md` and record the conflict.

## Process: one session at a time

Panchnama is built as a sequence of numbered sessions defined in
`implementation.md` section 14 ("Session-by-session development plan").

- Implement **only** the session you were asked to do. Do not implement
  later sessions, even if it looks convenient (e.g. don't add real schema
  logic while doing repository bootstrap; don't build UI while doing the
  crawler).
- Before starting, inspect the existing repository state and
  `docs/session-log.md` to see what prior sessions actually did — not just
  what implementation.md says they should have done.
- Do not begin a session until the previous session's exit criteria pass.
  If you discover a prerequisite defect in earlier work, you may fix it,
  but document the scope change in `docs/session-log.md`.
- Preserve completed work and existing user changes. Don't delete or
  rewrite files outside your session's scope without reason.
- Use the standard per-session prompt template in implementation.md
  section 15 as the process contract.

## Domain rules that apply to every session

- Use the shared types and schemas in `packages/schema`. Never duplicate
  domain types in another package.
- TypeScript strict mode throughout (see `tsconfig.base.json`); do not
  weaken it locally without an ADR.
- Follow the locked product decisions in implementation.md section 3 —
  they should not be reopened without recording an architecture decision
  under `docs/architecture-decisions/` (template: `0000-template.md`).
- Never make CI depend on live government websites. Live-network smoke
  tests are opt-in and excluded from ordinary CI (implementation.md
  section 11.2).
- Never publish unreviewed adverse findings, and never let citizen
  experience data mutate technical audit status (`technicalHealth`,
  `continuingRole`, `severity`, `suggestedAction`) — see implementation.md
  sections 5.14 and 9.
- Treat all crawled/user-submitted content as untrusted: never render raw
  HTML, escape displayed text, sanitize CSV exports against formula
  injection, and do not log request bodies or raw IP addresses
  (implementation.md sections 9.6–9.8 and 12.1).
- Before Session 17 sends any request to a live `.gov.in` host, the
  legal-risk and live-crawl approval gate in implementation.md section 12.5
  must be satisfied (ADR, target-host register, sign-off).

## Quality gates

Before considering any session's work done, run and pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

(implementation.md section 11.3). After UI work, also run the relevant
Playwright and accessibility tests once they exist. Add or update tests for
every behavior you change — do not merely assert correctness.

Before publishing an audit (once the pipeline exists):

```bash
pnpm audit sources:validate
pnpm audit inventory:validate --state assam
pnpm audit review:validate --run-id <id>
pnpm audit publish --run-id <id>
pnpm build
```

## Required bookkeeping

At the end of every session, update `docs/session-log.md` with: files
changed, decisions made (and why), tests run and their results, known
limitations, and the next session's prerequisites. This is the running
record another agent (or human) uses to pick up where you left off —
keep it honest, including about what you deferred or could not finish.

## Reporting

At completion of a session, report:

1. Outcome (pass/fail against the session's exit criteria).
2. Files changed.
3. Tests run and results (paste actual output, not a summary claim).
4. Deviations from `implementation.md`, if any, and why.
5. Risks or unresolved items.
6. Whether every exit criterion passed.
