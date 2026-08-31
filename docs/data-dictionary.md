# Data dictionary

**Status:** Hand-maintained mirror of `packages/schema`, not auto-generated.
If you change a Zod schema in `packages/schema/src`, update this document in
the same commit. The Zod schemas are the source of truth at runtime; this
document exists so a human (reviewer, editor, or future contributor) can
read the contract without opening TypeScript.

This document covers implementation.md section 5 exactly: every
enumeration, every entity, and the cross-cutting conventions that apply to
all of them.

## Cross-cutting conventions

- **`schemaVersion`.** Every top-level stored/published record carries a
  required, non-empty `schemaVersion` string, even where the interface in
  section 5 doesn't literally show the field (only `AuditRun` does).
  Current version constants live in `packages/schema/src/common.ts`
  (`SCHEMA_VERSIONS`); every entity is at `"1.0.0"`. Nested value objects
  that only ever exist embedded inside a parent record (`Portal.discovery[]`
  entries, `PageObservation.redirectChain[]` entries,
  `PublishedPortalAssessment.crawlCoverage`) do not carry their own
  `schemaVersion`.
- **IDs.** Every `id`, `portalId`, `runId`, `findingId`,
  `overlapComparisonId`, and similar field is a `stableId`: a non-empty
  string built only from the unreserved URL character set
  (`A-Z a-z 0-9 - . _ ~`). Array indexes must never be used as IDs — this is
  a rule for the code that generates IDs, not something Zod can check
  structurally.
- **Timestamps.** All timestamp fields are ISO 8601 UTC strings.
- **Unknown fields.** Every schema in this package is `.strict()` — an
  unrecognized key fails validation instead of being silently dropped. This
  is deliberate: an audit/evidence trail should surface a producer/schema
  mismatch loudly, not lose data quietly.
- **Migration convention.** No working migration system exists yet. A
  future breaking change to an entity's shape should: bump its
  `SCHEMA_VERSIONS` constant, keep the old schema available under a
  versioned name, and add an explicit `migrateXV1ToV2` function — never a
  silent in-place coercion.

## Enumerations

### `OfficialStatus`

How confidently a portal is admitted to the observed estate.

| Value        | Meaning                                                            |
| ------------ | ------------------------------------------------------------------ |
| `verified`   | At least one trusted government source lists/links it as official. |
| `unverified` | Candidate, not yet manually confirmed.                             |
| `disputed`   | Conflicting signals about its official status.                     |

### `TechnicalHealth`

Portal-level technical status, derived per section 7.7.

| Value            | Meaning                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `healthy`        | No reviewed critical/significant finding within measured coverage. Not a certification. |
| `degraded`       | Reachable, but at least one reviewed critical/significant technical finding exists.     |
| `unavailable`    | Entry point meets a reviewed unavailability rule.                                       |
| `not_assessable` | Core access could not be fairly assessed.                                               |

### `ContinuingRole`

Whether the portal appears to duplicate another portal's function.

| Value              | Meaning                                               |
| ------------------ | ----------------------------------------------------- |
| `distinct`         | Reviewed and found not to overlap.                    |
| `possible_overlap` | Reviewed and flagged for possible functional overlap. |
| `unclear`          | Reviewed but inconclusive.                            |
| `not_reviewed`     | No overlap review has happened yet.                   |

### `SuggestedAction`

Deterministic next-step template (section 7.8).

| Value                  | Meaning                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `maintain`             | No action needed beyond normal upkeep.                           |
| `repair`               | Fix a specific broken/degraded element.                          |
| `review_consolidation` | Human review of possible overlap/consolidation.                  |
| `review_retirement`    | Human review of possible retirement (never from downtime alone). |
| `manual_assessment`    | Automated checks are insufficient; a human must assess.          |

### `Severity`

| Value         | Meaning                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `critical`    | Portal or essential citizen route unavailable, or comparable blocking failure.                                      |
| `significant` | Substantial navigation/HTTPS/certificate failure or verified stale service info.                                    |
| `advisory`    | Directory inconsistency, weak freshness evidence, possible overlap, etc. — needs attention, doesn't prove blockage. |

### `Confidence`

| Value    | Meaning                                                           |
| -------- | ----------------------------------------------------------------- |
| `high`   | Repeated direct observation, unambiguous evidence.                |
| `medium` | Multiple supporting signals; context could change interpretation. |
| `low`    | Heuristic/incomplete evidence; must not be framed categorically.  |

### `ReviewStatus`

| Value                   | Meaning                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `automated_observation` | Generated by a rule, not yet human-reviewed.                 |
| `pending_review`        | Queued for human review.                                     |
| `reviewed`              | A human has reviewed and accepted it (see `ReviewDecision`). |
| `rejected`              | A human reviewed and rejected it.                            |
| `not_assessable`        | Could not be fairly assessed.                                |

### `CheckStatus`

Generic per-check outcome, used by `Finding.checkStatus` and
`LinkObservation.status`.

| Value            | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `pass`           | Check passed.                                                          |
| `fail`           | Check failed.                                                          |
| `warning`        | Check produced a non-blocking concern.                                 |
| `not_applicable` | Check does not apply to this subject.                                  |
| `not_assessable` | Check could not be fairly run/interpreted; requires a recorded reason. |

### `EvidenceType`

| Value                    | Meaning                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `http_response_snapshot` | Captured raw/summarized HTTP response.                         |
| `screenshot`             | Captured page screenshot.                                      |
| `text_excerpt`           | Captured excerpt of visible page text.                         |
| `redirect_chain`         | Captured sequence of redirects.                                |
| `certificate_detail`     | Captured TLS certificate observation.                          |
| `directory_listing`      | Captured directory-source entry.                               |
| `link_check_result`      | Captured link-check outcome.                                   |
| `manual_note`            | Reviewer-authored note (e.g. an overlap comparison rationale). |

### `ExperienceStatus`

| Value             | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `pending`         | Submitted, awaiting moderation.                                       |
| `approved`        | Moderated and approved for publication.                               |
| `rejected`        | Moderated and rejected.                                               |
| `needs_redaction` | Approved in substance but text requires redaction before publication. |

### `TaskOutcome`

| Value                 | Meaning                                     |
| --------------------- | ------------------------------------------- |
| `completed`           | Citizen completed the task.                 |
| `partially_completed` | Citizen partially completed the task.       |
| `not_completed`       | Citizen could not complete the task.        |
| `information_only`    | Visit was informational, no task attempted. |

### `ExperienceTheme`

| Value                  | Meaning                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `availability`         | Site/service was down or unreachable.                                                                                                                                 |
| `navigation`           | Difficulty finding the right page/section.                                                                                                                            |
| `content_clarity`      | Content was unclear or confusing.                                                                                                                                     |
| `outdated_information` | Information appeared out of date.                                                                                                                                     |
| `login_or_otp`         | Login or OTP problem.                                                                                                                                                 |
| `form_or_validation`   | Form or validation problem.                                                                                                                                           |
| `payment`              | Payment problem.                                                                                                                                                      |
| `document_upload`      | Document upload problem.                                                                                                                                              |
| `mobile_usability`     | Mobile usability problem.                                                                                                                                             |
| `language`             | Language problem — including that the portal (or, self-referentially, Panchnama's own v1 form) isn't available in the citizen's language; see implementation.md §2.2. |
| `accessibility`        | Accessibility problem.                                                                                                                                                |
| `support`              | Support/help problem.                                                                                                                                                 |
| `other`                | Anything else.                                                                                                                                                        |

## Entities

Each entity below is a `.strict()` Zod object schema in
`packages/schema/src`, with an inferred TypeScript type of the same name
(camelCase schema export, PascalCase type export — e.g. `portalSchema` /
`Portal`).

### `InventorySource` — `inventory-source.ts`

One documented official source used to seed the inventory.

| Field           | Type      | Optional | Description                                                   |
| --------------- | --------- | -------- | ------------------------------------------------------------- |
| `id`            | stableId  |          | Unique source ID.                                             |
| `schemaVersion` | string    |          | Record schema version.                                        |
| `name`          | string    |          | Human-readable source name.                                   |
| `authorityName` | string    |          | Issuing government authority.                                 |
| `url`           | URL       |          | Source URL.                                                   |
| `sourceType`    | enum      |          | `official_directory` \| `official_page` \| `manual_verified`. |
| `retrievedAt`   | timestamp |          | When the source was retrieved.                                |
| `evidencePath`  | string    | yes      | Path to a stored snapshot of the source.                      |
| `notes`         | string    | yes      | Free-text notes.                                              |

### `Portal` — `portal.ts`

One independently operated website/service portal (the unit of analysis).

| Field            | Type           | Optional | Description                                                                                                                                                 |
| ---------------- | -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | stableId       |          | Unique portal ID.                                                                                                                                           |
| `schemaVersion`  | string         |          | Record schema version.                                                                                                                                      |
| `name`           | string         |          | Portal name.                                                                                                                                                |
| `canonicalUrl`   | URL            |          | Canonical entry URL.                                                                                                                                        |
| `alternateUrls`  | URL[]          |          | Other known URLs for the same portal.                                                                                                                       |
| `hostnames`      | string[]       |          | Hostnames this portal spans.                                                                                                                                |
| `description`    | string         | yes      | Short description.                                                                                                                                          |
| `department`     | string         | yes      | Owning department.                                                                                                                                          |
| `geography`      | `"assam"`      |          | Fixed geography literal for v1.                                                                                                                             |
| `portalType`     | enum           |          | `information` \| `transactional` \| `directory` \| `mixed` \| `unknown`.                                                                                    |
| `officialStatus` | OfficialStatus |          | See enum above.                                                                                                                                             |
| `sourceRefs`     | stableId[]     |          | `InventorySource.id`s that admitted this portal.                                                                                                            |
| `discovery`      | object[]       |          | Discovery provenance entries: `discoveredAt`, `discoveredFromUrl`, `discoveryMethod` (`listed` \| `outbound_link` \| `manual`). Not individually versioned. |
| `tags`           | string[]       |          | Free-form tags.                                                                                                                                             |
| `crawlProfile`   | string         | yes      | Named crawl-policy override profile.                                                                                                                        |

**Deferred invariant:** "a published portal must reference at least one
inventory source" needs the actual `InventorySource` record set and is not
checked here (see TODO in `portal.ts`).

### `AuditRun` — `audit-run.ts`

One dated, reproducible audit execution.

| Field                   | Type      | Optional | Description                                               |
| ----------------------- | --------- | -------- | --------------------------------------------------------- |
| `id`                    | stableId  |          | e.g. `assam-2026-09-15-r1`.                               |
| `geography`             | `"assam"` |          | Fixed literal.                                            |
| `startedAt`             | timestamp |          | Run start.                                                |
| `completedAt`           | timestamp | yes      | Required once `status` is terminal (see invariant below). |
| `status`                | enum      |          | `running` \| `completed` \| `partial` \| `failed`.        |
| `methodologyVersion`    | string    |          | Methodology version in effect.                            |
| `schemaVersion`         | string    |          | Record schema version.                                    |
| `codeRevision`          | string    | yes      | Git revision, when available.                             |
| `nodeVersion`           | string    |          | Node.js version used.                                     |
| `packageVersionsDigest` | string    |          | Digest of the resolved lockfile.                          |
| `sourceRegistryDigest`  | string    |          | Digest of `config/sources.*.yaml`.                        |
| `crawlPolicyDigest`     | string    |          | Digest of `config/crawl-policy.yaml`.                     |
| `checkConfigDigest`     | string    |          | Digest of `config/checks.yaml`.                           |
| `enabledChecks`         | string[]  |          | Rule IDs active for this run.                             |
| `portalCount`           | number    |          | Total portals in scope.                                   |
| `portalsSucceeded`      | number    |          | Portals fully processed.                                  |
| `portalsFailed`         | number    |          | Portals that failed entirely.                             |
| `portalsPartial`        | number    |          | Portals partially processed.                              |
| `limitations`           | string[]  |          | Known limitations of this run.                            |

**Enforced invariants (§5.14):** `portalsSucceeded + portalsFailed +
portalsPartial === portalCount`; `completedAt` required once `status !==
"running"`; `completed` requires all portals succeeded, `failed` requires
none succeeded, `partial` requires a genuine mix (this package's documented
interpretation of "derived consistently from those counts").

### `PageObservation` — `observation.ts`

One fetch attempt of one URL within one run.

| Field            | Type        | Optional | Description                                           |
| ---------------- | ----------- | -------- | ----------------------------------------------------- |
| `id`             | stableId    |          | Unique observation ID.                                |
| `schemaVersion`  | string      |          | Record schema version.                                |
| `runId`          | stableId    |          | Owning `AuditRun.id`.                                 |
| `portalId`       | stableId    |          | Owning `Portal.id`.                                   |
| `requestedUrl`   | URL         |          | URL requested.                                        |
| `finalUrl`       | URL         | yes      | URL after redirects.                                  |
| `discoveredFrom` | URL         | yes      | URL this was discovered from.                         |
| `checkedAt`      | timestamp   |          | When checked.                                         |
| `attempt`        | number (>0) |          | Attempt number.                                       |
| `fetchMode`      | enum        |          | `http` \| `browser`.                                  |
| `httpStatus`     | number      | yes      | HTTP status code.                                     |
| `redirectChain`  | object[]    |          | `{ url, status? }` entries.                           |
| `contentType`    | string      | yes      | Response content type.                                |
| `durationMs`     | number      | yes      | Request duration.                                     |
| `title`          | string      | yes      | Page title.                                           |
| `canonical`      | string      | yes      | Canonical link value.                                 |
| `language`       | string      | yes      | Detected/declared language.                           |
| `bodyDigest`     | string      | yes      | Hash of response body.                                |
| `errorCode`      | string      | yes      | Stable error code (§9.3), if failed.                  |
| `errorMessage`   | string      | yes      | Human error message, if failed.                       |
| `robotsDecision` | enum        |          | `allowed` \| `disallowed` \| `not_checked`.           |
| `artifactRefs`   | stableId[]  |          | `EvidenceArtifact.id`s captured for this observation. |

### `LinkObservation` — `observation.ts`

One checked link destination.

| Field                      | Type        | Optional | Description                          |
| -------------------------- | ----------- | -------- | ------------------------------------ |
| `id`                       | stableId    |          | Unique observation ID.               |
| `schemaVersion`            | string      |          | Record schema version.               |
| `runId`                    | stableId    |          | Owning `AuditRun.id`.                |
| `portalId`                 | stableId    |          | Owning `Portal.id`.                  |
| `sourcePageUrl`            | URL         |          | Page the link was found on.          |
| `destinationUrl`           | URL         |          | Link target as observed.             |
| `normalizedDestinationUrl` | URL         |          | Normalized target (§6.5).            |
| `anchorText`               | string      | yes      | Link anchor text.                    |
| `relationship`             | enum        |          | `internal` \| `external`.            |
| `context`                  | string      | yes      | Where on the page the link appeared. |
| `checkedAt`                | timestamp   |          | When checked.                        |
| `status`                   | CheckStatus |          | Outcome of the check.                |
| `httpStatus`               | number      | yes      | HTTP status code.                    |
| `errorCode`                | string      | yes      | Stable error code, if failed.        |
| `attempts`                 | number      |          | Number of attempts made.             |

**Enforced invariant:** `status === "not_assessable"` requires `errorCode`
(this package's interpretation of "`not_assessable` must include a
reason").

### `Finding` — `finding.ts`

One candidate/reviewed audit finding.

| Field                 | Type               | Optional                                       | Description                                                                                                                  |
| --------------------- | ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | stableId           |                                                | Unique finding ID.                                                                                                           |
| `schemaVersion`       | string             |                                                | Record schema version.                                                                                                       |
| `runId`               | stableId           |                                                | Owning `AuditRun.id`.                                                                                                        |
| `portalId`            | stableId           |                                                | Affected `Portal.id`.                                                                                                        |
| `ruleId`              | string             |                                                | Rule that generated this finding.                                                                                            |
| `category`            | enum               |                                                | `availability` \| `broken_link` \| `https` \| `freshness` \| `directory_mismatch` \| `possible_overlap` \| `crawl_coverage`. |
| `title`               | string             |                                                | Short title.                                                                                                                 |
| `summary`             | string             |                                                | Plain-language summary (editorial policy, §8.4).                                                                             |
| `severity`            | Severity           |                                                | See enum above.                                                                                                              |
| `confidence`          | Confidence         |                                                | See enum above.                                                                                                              |
| `checkStatus`         | CheckStatus        |                                                | Underlying check outcome.                                                                                                    |
| `reviewStatus`        | ReviewStatus       |                                                | Human review state.                                                                                                          |
| `firstObservedAt`     | timestamp          |                                                | First observation supporting this finding.                                                                                   |
| `lastObservedAt`      | timestamp          |                                                | Latest observation supporting this finding.                                                                                  |
| `evidenceRefs`        | stableId[] (min 1) |                                                | `EvidenceArtifact.id`s.                                                                                                      |
| `affectedUrls`        | URL[]              |                                                | URLs this finding concerns.                                                                                                  |
| `suggestionRuleId`    | string             |                                                | Rule that produced `suggestedAction`.                                                                                        |
| `suggestedAction`     | SuggestedAction    |                                                | See enum above.                                                                                                              |
| `overlapComparisonId` | stableId           | required iff `category === "possible_overlap"` | `PortalOverlapComparison.id`.                                                                                                |
| `reviewerRationale`   | string             | yes                                            | Reviewer's rationale.                                                                                                        |
| `limitations`         | string[]           |                                                | Known limitations; required non-empty when `checkStatus === "not_assessable"`.                                               |

**Enforced invariants (§5.14):** `overlapComparisonId` required when
`category === "possible_overlap"`; `evidenceRefs` non-empty; `limitations`
non-empty when `checkStatus === "not_assessable"`. **Deferred:** evidence
refs actually resolving to `privacyReviewed: true` artifacts; the overlap
comparison relationship/run/portal/conclusion checks; review-decision
presence for interpretive findings; `review_retirement` not coming from
technical failure alone — all need the full record set and belong to the
publish pipeline (session 8).

### `EvidenceArtifact` — `evidence.ts`

One stored piece of evidence backing observations/findings.

| Field                  | Type         | Optional | Description                                    |
| ---------------------- | ------------ | -------- | ---------------------------------------------- |
| `id`                   | stableId     |          | Unique artifact ID.                            |
| `schemaVersion`        | string       |          | Record schema version.                         |
| `runId`                | stableId     |          | Owning `AuditRun.id`.                          |
| `portalId`             | stableId     |          | Owning `Portal.id`.                            |
| `type`                 | EvidenceType |          | See enum above.                                |
| `capturedAt`           | timestamp    |          | Capture time.                                  |
| `sourceUrl`            | URL          | yes      | URL the evidence was captured from.            |
| `relatedObservationId` | stableId     | yes      | `PageObservation.id` or `LinkObservation.id`.  |
| `storagePath`          | string       |          | Path under `data/evidence/`.                   |
| `contentDigest`        | string       |          | Integrity hash of the stored artifact.         |
| `mimeType`             | string       | yes      | MIME type.                                     |
| `description`          | string       |          | Plain-language caption (editorially reviewed). |
| `privacyReviewed`      | boolean      |          | Whether privacy review has occurred.           |
| `privacyReviewedAt`    | timestamp    | yes      | When privacy-reviewed.                         |
| `privacyReviewer`      | string       | yes      | Who reviewed it.                               |
| `redactions`           | string[]     | yes      | What was removed before storage, if anything.  |

**Deferred (publish-gate) rule:** an artifact with `privacyReviewed: false`
must never be reachable from a published finding — this constrains which
`Finding`s may cite it, not the artifact record itself; enforced at publish
time (session 8), not here.

### `PortalOverlapComparison` — `overlap.ts`

One structured, manual comparison of two portals (§7.6).

| Field                         | Type               | Optional | Description                                                                                                            |
| ----------------------------- | ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                          | stableId           |          | Unique comparison ID.                                                                                                  |
| `schemaVersion`               | string             |          | Record schema version.                                                                                                 |
| `runId`                       | stableId           |          | Owning `AuditRun.id`.                                                                                                  |
| `portalIdA` / `portalIdB`     | stableId           |          | The two portals compared; must differ.                                                                                 |
| `status`                      | `"completed"`      |          | Fixed literal — only completed comparisons are modeled.                                                                |
| `reviewedAt`                  | timestamp          |          | When reviewed.                                                                                                         |
| `reviewer`                    | string             |          | Reviewer identifier.                                                                                                   |
| `intendedUserA` / `B`         | string             |          | Intended user of each portal.                                                                                          |
| `serviceOrTaskA` / `B`        | string             |          | Service/task offered by each portal.                                                                                   |
| `jurisdictionA` / `B`         | string             | yes      | Jurisdiction.                                                                                                          |
| `transactionStageA` / `B`     | string             | yes      | Transaction stage.                                                                                                     |
| `responsibleAuthorityA` / `B` | string             | yes      | Responsible authority.                                                                                                 |
| `linksOrRedirectsBetween`     | boolean            |          | Whether either portal links/redirects to the other.                                                                    |
| `materialSimilarities`        | string[]           |          | Similarities found.                                                                                                    |
| `materialDifferences`         | string[]           |          | Differences found.                                                                                                     |
| `conclusion`                  | enum               |          | `possible_overlap` \| `distinct` \| `insufficient_evidence` — `duplicate`/`redundant` are not valid values, by design. |
| `uncertaintyNote`             | string             |          | Reviewer's uncertainty note.                                                                                           |
| `evidenceRefs`                | stableId[] (min 1) |          | `EvidenceArtifact.id`s.                                                                                                |

**Enforced invariants (§5.14):** `portalIdA !== portalIdB`; `evidenceRefs`
non-empty. **Deferred:** both portal IDs resolving to real `Portal`
records, and referenced evidence being `privacyReviewed: true` — cross-record,
belongs to the publish pipeline.

### `PublishedPortalAssessment` — `published-assessment.ts`

The published, portal-level scorecard record.

| Field                                                                       | Type            | Optional | Description                                                                               |
| --------------------------------------------------------------------------- | --------------- | -------- | ----------------------------------------------------------------------------------------- |
| `schemaVersion`                                                             | string          |          | Record schema version.                                                                    |
| `portal`                                                                    | Portal          |          | Embedded portal record.                                                                   |
| `auditRunId`                                                                | stableId        |          | Owning `AuditRun.id`.                                                                     |
| `technicalHealth`                                                           | TechnicalHealth |          | See enum above.                                                                           |
| `continuingRole`                                                            | ContinuingRole  |          | See enum above.                                                                           |
| `suggestedAction`                                                           | SuggestedAction |          | See enum above.                                                                           |
| `criticalFindingCount` / `significantFindingCount` / `advisoryFindingCount` | number          |          | Counts by severity.                                                                       |
| `crawlCoverage`                                                             | object          |          | `pagesAttempted`, `pagesObserved`, `linksChecked`, `browserFallbackUsed`, `coverageNote`. |
| `reviewedFindings`                                                          | Finding[]       |          | Embedded reviewed findings.                                                               |
| `lastCheckedAt`                                                             | timestamp       |          | Last check time.                                                                          |

**Enforced invariants (§5.14):** `technicalHealth === "healthy"` requires no
finding in `reviewedFindings` with `reviewStatus === "reviewed"` and
`severity` in `{critical, significant}`; `technicalHealth ===
"not_assessable"` requires a non-empty `crawlCoverage.coverageNote`.
**Deferred:** "every exported result must include audit date, methodology
version, and limitations" needs the referenced `AuditRun` — cross-record.

### `ReviewDecision` — `review.ts`

One human review decision on a finding. Keyed by `findingId`, not its own
`id`, per the spec.

| Field                | Type            | Optional | Description                                     |
| -------------------- | --------------- | -------- | ----------------------------------------------- |
| `schemaVersion`      | string          |          | Record schema version.                          |
| `findingId`          | stableId        |          | `Finding.id` being reviewed.                    |
| `decision`           | enum            |          | `publish` \| `reject` \| `needs_more_evidence`. |
| `reviewedAt`         | timestamp       |          | When reviewed.                                  |
| `reviewer`           | string          |          | Case-study author identifier (not secret PII).  |
| `rationale`          | string          |          | Reviewer's rationale.                           |
| `overriddenSeverity` | Severity        | yes      | Severity override, if any.                      |
| `overriddenAction`   | SuggestedAction | yes      | Suggested-action override, if any.              |

**Deferred:** "review overrides must preserve the original automated value"
needs the reviewed `Finding`'s original values — cross-record.

### `ExperienceSubmission` — `experience.ts`

One anonymous citizen-experience submission.

| Field                  | Type                 | Optional | Description                                                 |
| ---------------------- | -------------------- | -------- | ----------------------------------------------------------- |
| `id`                   | stableId             |          | Unique submission ID.                                       |
| `schemaVersion`        | string               |          | Record schema version.                                      |
| `portalId`             | stableId             |          | Portal this experience concerns.                            |
| `createdAt`            | timestamp            |          | Submission time.                                            |
| `occurredOn`           | string               | yes      | Month/date only — never inferred more precisely.            |
| `taskType`             | string               |          | Controlled vocabulary + `"other"`.                          |
| `taskDescription`      | string (≤280 chars)  | yes      | Short optional description.                                 |
| `outcome`              | TaskOutcome          |          | See enum above.                                             |
| `themes`               | ExperienceTheme[]    |          | Selected themes.                                            |
| `deviceType`           | enum                 | yes      | `mobile` \| `desktop` \| `tablet` \| `other`.               |
| `experienceRating`     | 1–5                  | yes      | Optional rating.                                            |
| `freeText`             | string (≤1000 chars) | yes      | Original free text; moderation required before display.     |
| `consentToPublish`     | boolean              |          | Consent flag.                                               |
| `status`               | ExperienceStatus     |          | See enum above.                                             |
| `moderatedAt`          | timestamp            | yes      | When moderated.                                             |
| `moderationReasonCode` | string               | yes      | Moderation reason code.                                     |
| `publicText`           | string               | yes      | Redacted text for publication; never overwrites `freeText`. |
| `source`               | enum                 |          | `public_form` \| `research_interview`.                      |
| `privacyFlags`         | string[]             |          | Automated privacy-pattern flags.                            |
| `duplicateOf`          | stableId             | yes      | Another submission ID this duplicates.                      |

No name, email, phone, government ID, application/reference number, account
identifier, attachment, or exact address field exists on this schema by
design (enforced by omission plus `.strict()` rejecting any such field a
caller tries to add). **Deferred (not single-record-checkable):** public
return requiring `consentToPublish && status === "approved"`; `portalId`
resolving to a real, published portal; aggregation excluding
pending/rejected records — all query/pipeline-time rules, not shape rules.

### `PortalExperienceSummary` — `experience.ts`

Aggregate of approved experiences for one portal.

| Field                                             | Type           | Optional | Description                                                 |
| ------------------------------------------------- | -------------- | -------- | ----------------------------------------------------------- |
| `schemaVersion`                                   | string         |          | Record schema version.                                      |
| `portalId`                                        | stableId       |          | Portal this summarizes.                                     |
| `approvedExperienceCount`                         | number         |          | Count of approved experiences.                              |
| `outcomeCounts`                                   | object         |          | Count per `TaskOutcome` value (all four keys required).     |
| `themeCounts`                                     | partial object |          | Count per `ExperienceTheme` value (keys present as needed). |
| `ratingCount`                                     | number         |          | Number of ratings included.                                 |
| `averageRating`                                   | number (1–5)   | yes      | Average rating, only when meaningful.                       |
| `earliestExperienceDate` / `latestExperienceDate` | string         | yes      | Covered date range.                                         |
| `minimumDisplayThresholdApplied`                  | boolean        |          | Whether small-sample display rules were applied.            |
| `generatedAt`                                     | timestamp      |          | Generation time.                                            |
