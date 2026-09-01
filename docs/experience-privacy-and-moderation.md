# Experience privacy and moderation policy

This document is the human-readable policy behind `POST /api/experiences` and
`GET /api/portals/:portalId/experiences` (implementation.md sections 9.6–9.8).
It is referenced from code comments (e.g. `apps/web/src/lib/abuseKey.ts`) as
the canonical explanation of what this system does and does not do with a
citizen's submission. Session 11+'s public form and portal pages should link
to this document (or a rendered version of it) rather than restate it.

## What Panchnama collects

An anonymous experience submission is a structured account of one attempt to
use one listed government portal: which task, what happened, optional
free-text description, and optional consent to publish. Panchnama does not
ask for names, accounts, identity numbers, application numbers, phone
numbers, or documents (product principle 10, section 1.6). No submission
requires a login or account.

The server never stores a citizen's raw IP address. It stores only a keyed,
one-way HMAC hash of the request's network address (the "abuse key"), used
solely to rate-limit and detect near-duplicate submissions. See
`apps/web/src/lib/abuseKey.ts` for the exact derivation and its documented
limitations (shared NAT addresses, IPv6 rotation).

## Privacy-pattern flags

Free-text fields are scanned for patterns that commonly indicate personal or
identifying information: email addresses, Indian mobile numbers, Aadhaar- and
PAN-shaped sequences, and other long digit runs (8+) that could be reference,
application, payment, or account numbers (see
`apps/web/src/lib/privacyFlags.ts`). A match never blocks or rejects a
submission — it only raises a moderation flag a human reviewer sees before
any decision. These flags are a detection aid, not proof that a submission
does or does not contain personal information, and not proof that a
submission without a flag is safe to publish as-is.

## Moderation policy (implementation.md section 9.7)

Every submission is stored as `pending` and is invisible to the public until
a moderator reviews it via the `experiences:*` CLI commands
(`pnpm experiences:queue`, `pnpm experiences:moderate`). A moderator approves
a submission only when it:

- describes a first-hand or clearly attributed portal experience;
- relates to the selected portal;
- contains no personal, identity, application, payment, or confidential
  information;
- includes no threats, abuse, spam, promotional content, or unverifiable
  accusations about individuals;
- is understandable enough to categorize;
- includes consent to publish (`consentToPublish: true`).

A moderator may redact personal information into a separate `publicText`
value (decision `needs_redaction`) but must not silently rewrite the
submission's meaning. Every decision records a reason code
(`moderationReasonCode`). The public UI (Session 15+) must describe
published experiences as moderated for relevance, privacy, and safety — never
as verified, representative, or audited facts. Experiences never feed into
audit health, severity, role, or suggested-action calculations (product
principle 9, section 1.6); they are read from a wholly separate table set
(`experience_submissions`/`experience_moderation`) that no audit-pipeline
code (`packages/audit-core`, `packages/audit-cli`) imports from.

## Retention

Per section 9.8's recommended starting policy, implemented by
`pnpm experiences:retention`:

- Rejected original submissions are deleted 90 days after the rejection
  decision.
- Expired abuse-key events are deleted after 24 hours.
- Approved public records are retained until withdrawn (see "Requesting
  removal" below) or superseded by a later moderation decision.

## Requesting removal (placeholder contact procedure)

Section 9.8 requires "a contact route for requesting removal of a published
experience, without requiring an account." Version one has no public web form
or ticketing system for this (out of scope per section 2.2: no user accounts,
no case tracking). The placeholder procedure for this prototype is:

1. A published portal experience page (Session 15+) will display a static
   contact email address for removal requests, alongside the portal it was
   published under and enough context (e.g. approximate submission date, task
   type) for an operator to locate the specific record — never requiring the
   requester to identify themselves beyond what they choose to say.
2. An operator with CLI/database access locates the submission by portal and
   approximate timing, confirms it matches the request, and either re-runs
   `pnpm experiences:moderate` with a `reject` decision (removing it from
   public reads immediately — `getApprovedExperiences` only returns
   `status: "approved"` rows) or deletes the row directly if immediate
   deletion (not just un-publishing) is requested.
3. No automated self-service removal exists in version one. A real production
   deployment should replace this with a monitored inbox or a lightweight
   authenticated removal-request form; that is future work (section 18), not
   built in this session.

This is a documented placeholder, not a finished contact channel: no real
email address is wired up yet, since there is no deployed instance of
Panchnama to receive removal requests. Session 16 (trust surfaces) and/or the
eventual deployment session (Session 22) must fill in a real address before
any public launch.

## What is explicitly out of scope

- Authentication, accounts, or profiles for submitters or moderators.
- A public-facing moderation panel or dashboard.
- Automatically publishing a submission without moderation.
- Forwarding a submission to a government department, or treating it as a
  grievance-resolution channel.
- Third-party analytics on submission form pages or payloads (section 9.8).
