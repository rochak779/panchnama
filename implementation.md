# Panchnama — Implementation Plan

**Document status:** Build-ready blueprint  
**Project type:** Independent government/public-sector case-study prototype  
**Initial geography:** Assam, India  
**Primary audience:** State web-governance and IT audit teams  
**Product:** Public, evidence-backed government website audit scorecard with anonymous, moderated citizen-experience submissions  

---

## 1. Product definition

### 1.1 One-sentence proposition

Panchnama is a repeatable public audit that shows which Assam government websites need attention, why they were flagged, and what should happen next—with dated evidence anyone can inspect.

### 1.2 Problem

Government websites are created and maintained by separate departments, boards, authorities, and vendors. There is no readily inspectable, continuously reproducible view of the observed web estate that answers:

- Which official portals are reachable?
- Which official pages lead citizens to broken destinations?
- Which portals have HTTPS or certificate problems?
- Which portals show credible signs of stale or obsolete content?
- Which official websites are missing from directories, or which directory entries no longer resolve?
- Which portals appear to perform overlapping functions and deserve human review?
- What evidence supports each finding, and what action should an owner consider?

The product does not claim to establish the complete legal inventory of government systems. It audits an explicitly bounded **observed web estate** assembled from named official sources.

### 1.3 Initial user

The principal user is a state official or small web-governance team responsible for understanding and improving the government's web estate. The public can inspect the same published evidence and anonymously submit a structured account of using a listed portal. The experience feature is research evidence, not a grievance-resolution channel, help desk, or substitute for an official complaint.

### 1.4 Core user task

> Identify the portals requiring attention, understand why each was flagged, inspect the supporting evidence, and determine the suggested next action.

### 1.5 Case-study thesis

Government cannot improve, consolidate, or retire a web estate it cannot see. A bounded, reproducible diagnostic is the credible first step before consolidation or redesign.

### 1.6 Product principles

1. **Evidence before judgment.** Every published finding must cite a URL, observation, timestamp, and audit rule.
2. **No false precision.** Do not create a composite score out of unrelated checks.
3. **Uncertainty is visible.** `Not assessable` and `Review required` are legitimate outcomes.
4. **Observed estate, not claimed completeness.** Every portal must have discovery provenance.
5. **Automation collects evidence; people make policy judgments.** The system may flag overlap but cannot decide to close a government service.
6. **Citizen impact drives severity.** Severity is not based on technical novelty.
7. **A snapshot that can be rerun.** The prototype is dated and repeatable, not a live monitoring service.
8. **Independent and non-official.** The interface must not imply endorsement by the Government of Assam.
9. **Experience is not proof of system health.** Citizen reports are displayed separately from technical observations and never automatically change an audit verdict.
10. **Privacy by default.** Do not ask for names, accounts, identity numbers, application numbers, phone numbers, or documents.

---

## 2. Scope

### 2.1 Version-one scope

The Assam pilot will:

- ingest one or more documented official Assam directories as seed sources;
- preserve the source and discovery route of every website;
- identify citizen-facing websites and portals linked as official;
- crawl a bounded set of public HTML pages per portal;
- measure availability and redirects;
- check HTTPS and certificate observations available to the client;
- find broken internal and external links on crawled pages;
- collect cautious visible freshness signals;
- compare official directory listings with the observed estate;
- store manually reviewed possible functional overlaps;
- generate deterministic suggested actions;
- publish a dated overview, inventory, portal detail pages, and methodology;
- export the reviewed dataset as JSON and CSV;
- preserve sufficient evidence to reproduce or challenge findings.
- accept anonymous, structured user-experience submissions for portals already in the inventory;
- store submissions in a database and hold them for moderation;
- publish only approved, privacy-reviewed experiences in a separate portal-level section;
- aggregate experience themes and outcomes without merging them into technical audit findings.

### 2.2 Explicitly out of scope

- A nationwide production deployment.
- A claim that the observed inventory includes every Assam government property.
- Automated shutdown, retirement, or consolidation decisions.
- Penetration testing or vulnerability scanning.
- Legal, security, accessibility, or regulatory certification.
- Completing transactions, submitting forms, making payments, or bypassing authentication.
- Crawling private, login-gated, or personally identifiable data.
- Citizen complaints, case resolution, status tracking, or forwarding submissions to government departments.
- User accounts, sign-in, profiles, department permissions, comments, or remediation tickets.
- Scheduled monitoring, alerts, webhooks, or uptime guarantees.
- A government content-management system or unified service portal.
- Generative-AI-written findings presented as facts.
- State comparisons until at least two states have been audited under equivalent rules.
- Assamese or other non-English UI, including the experience-submission form. This is a known limitation, not a silent gap: `"language"` is itself a selectable `ExperienceTheme` (§5.1) citizens can use to flag a *government* portal's language problems, while Panchnama's own public-facing submission form is English-only in v1. State this limitation explicitly in the methodology page (§10.7) rather than leaving it implicit.

### 2.3 Definition of the observed Assam web estate

For version one:

> All citizen-facing websites or portals discoverable from the selected official Assam government directories and their outbound links, as observed on the audit date.

A portal is admitted as **verified official** when at least one trusted government source links to or lists it as official. Search-engine discovery alone is insufficient. Additional candidates can be recorded as `unverified` until manually confirmed.

### 2.4 Unit of analysis

One top-level scorecard record represents one independently operated website or service portal. A portal can span multiple hostnames when the relationship is documented. Individual pages, links, findings, and sampled citizen journeys are nested evidence—not separate top-level scorecard rows.

---

## 3. Locked product decisions

These decisions should not be reopened during implementation without recording an architecture decision.

| Decision | Choice |
|---|---|
| Product form | Public evidence scorecard with a separate anonymous experience-submission flow |
| Initial dataset | Observed Assam web estate |
| Data entry | Pre-ingested inventory; visitors do not submit URLs |
| Audit model | Automated observations plus offline human review |
| Runtime model | Dated snapshot that can be rerun |
| Overall numeric score | None |
| Result model | Technical health, continuing role, and suggested action are separate |
| Frontend/backend | Static audit datasets plus a small server-side API for experience submissions and approved-experience reads |
| Database | PostgreSQL with Drizzle ORM; local development through Docker Compose |
| Authentication | None for visitors or submitters; moderation is an offline CLI workflow, not a web admin account |
| Experience submissions | Anonymous, structured, rate-limited, moderated before publication |
| Evidence separation | Citizen experiences never automatically alter technical health, severity, or suggested action |
| AI dependency | None required for findings or recommendations |
| National expansion | Future hypothesis; not part of initial build |
| Branding | Clearly independent, unofficial case-study prototype |
| UI language | English only for v1; explicit known limitation, not an oversight — see §2.2 |
| Application hosting | Not locked. Requires an ADR before Session 22 naming the specific host for the hybrid static+API+PostgreSQL deployment; do not default silently at build time |

---

## 4. Recommended technical architecture

### 4.1 Stack

Use a TypeScript monorepo so the crawler, schema, rules, and frontend share types.

- **Package manager:** pnpm
- **Monorepo:** pnpm workspaces
- **Runtime:** Node.js 22 LTS or later
- **Language:** TypeScript in strict mode
- **Web app:** Next.js with App Router and static generation
- **Styling:** Tailwind CSS plus CSS custom properties for tokens
- **Schema validation:** Zod
- **Crawler HTTP client:** native `fetch`/Undici
- **HTML parsing:** Cheerio
- **Browser fallback:** Playwright, used only for explicitly configured JavaScript-rendered portals
- **Database:** PostgreSQL
- **Database toolkit:** Drizzle ORM and Drizzle Kit migrations
- **Local database:** Docker Compose with a pinned PostgreSQL image
- **Submission validation:** Shared Zod schemas at both API and persistence boundaries
- **Abuse controls:** server-side rate limiting, honeypot field, body-size limits, duplicate detection, and moderation queue
- **CLI:** Commander or a small typed command dispatcher
- **Tests:** Vitest for unit/integration tests; Playwright for end-to-end UI tests
- **Code quality:** ESLint and Prettier
- **Dates:** ISO 8601 UTC in stored data; localized display in the UI
- **Artifacts:** JSON, CSV, HTML snapshots/screenshots when appropriate
- **CI:** GitHub Actions

Pin exact versions in the lockfile when implementation begins. Do not put version numbers in this plan because they will age.

### 4.2 Why this architecture

- One language reduces handoff and schema drift.
- Static data keeps audit findings cheap, inspectable, and reliable, while the narrowly scoped database supports citizen submissions.
- The crawler remains a real executable artifact rather than a mocked dashboard.
- Raw observations can be regenerated independently of the UI.
- Human-reviewed data can be committed and audited through Git history.
- Anonymous experience submissions can be moderated without creating accounts or an admin application.
- A later production system can replace the storage layer without replacing the domain model.

### 4.3 Proposed repository structure

```text
/
├── apps/
│   └── web/                         # Next.js public scorecard
├── packages/
│   ├── audit-cli/                   # inventory, crawl, analyze, publish commands
│   ├── audit-core/                  # pure audit rules and classifiers
│   ├── database/                    # Drizzle schema, migrations, DB access
│   ├── schema/                      # shared Zod schemas and TypeScript types
│   └── ui/                          # optional shared UI primitives
├── config/
│   ├── sources.assam.yaml           # authoritative inventory sources
│   ├── crawl-policy.yaml            # limits, exclusions, rate controls
│   ├── checks.yaml                  # enabled checks and thresholds
│   └── portals/                     # per-portal crawl/render overrides
├── data/
│   ├── seed/                        # manually curated source inputs
│   ├── raw/                         # generated raw crawl data; mostly ignored
│   ├── evidence/                    # selected publishable evidence artifacts
│   ├── review/                      # human review decisions
│   ├── published/                   # validated static datasets consumed by web
│   └── fixtures/                    # deterministic test websites/data
├── docs/
│   ├── methodology.md
│   ├── editorial-policy.md
│   ├── crawl-policy.md
│   ├── data-dictionary.md
│   ├── architecture-decisions/
│   └── research/
├── scripts/
├── docker-compose.yml               # local PostgreSQL only
├── .github/workflows/
├── implementation.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 4.4 Pipeline

```text
Official source registry
        ↓
Inventory ingestion and normalization
        ↓
Verified / unverified portal registry
        ↓
Bounded fetch and crawl
        ↓
Immutable raw observations
        ↓
Deterministic audit rules
        ↓
Candidate findings
        ↓
Offline editorial review
        ↓
Validated publication dataset
        ↓
Static scorecard + JSON/CSV export
```

The frontend must never read unfinished raw crawl output directly. Publication is a deliberate transformation with schema validation and review gates.

Citizen experiences follow a separate pipeline:

```text
Anonymous structured form
        ↓
Server validation + abuse/privacy checks
        ↓
PostgreSQL pending-submission record
        ↓
Offline moderation CLI
        ↓
Approved and optionally redacted experience
        ↓
Portal-level experience section + aggregate themes
```

This pipeline must not write into raw crawler observations or derive technical audit status. The database is authoritative for incoming experiences; published audit JSON remains authoritative for technical findings.

---

## 5. Domain model and data contracts

All IDs must be stable, URL-safe strings. Never use array indexes as identifiers. Every schema must include `schemaVersion`.

### 5.1 Enumerations

```ts
type OfficialStatus = "verified" | "unverified" | "disputed";

type TechnicalHealth =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "not_assessable";

type ContinuingRole =
  | "distinct"
  | "possible_overlap"
  | "unclear"
  | "not_reviewed";

type SuggestedAction =
  | "maintain"
  | "repair"
  | "review_consolidation"
  | "review_retirement"
  | "manual_assessment";

type Severity = "critical" | "significant" | "advisory";

type Confidence = "high" | "medium" | "low";

type ReviewStatus =
  | "automated_observation"
  | "pending_review"
  | "reviewed"
  | "rejected"
  | "not_assessable";

type CheckStatus =
  | "pass"
  | "fail"
  | "warning"
  | "not_applicable"
  | "not_assessable";
```

### 5.2 Source record

```ts
interface InventorySource {
  id: string;
  name: string;
  authorityName: string;
  url: string;
  sourceType: "official_directory" | "official_page" | "manual_verified";
  retrievedAt: string;
  evidencePath?: string;
  notes?: string;
}
```

### 5.3 Portal record

```ts
interface Portal {
  id: string;
  name: string;
  canonicalUrl: string;
  alternateUrls: string[];
  hostnames: string[];
  description?: string;
  department?: string;
  geography: "assam";
  portalType: "information" | "transactional" | "directory" | "mixed" | "unknown";
  officialStatus: OfficialStatus;
  sourceRefs: string[];
  discovery: {
    discoveredAt: string;
    discoveredFromUrl: string;
    discoveryMethod: "listed" | "outbound_link" | "manual";
  }[];
  tags: string[];
  crawlProfile?: string;
}
```

### 5.4 Crawl run

```ts
interface AuditRun {
  id: string;                       // e.g. assam-2026-09-15-r1
  geography: "assam";
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "partial" | "failed";
  methodologyVersion: string;
  schemaVersion: string;
  codeRevision?: string;
  nodeVersion: string;
  packageVersionsDigest: string;      // digest of the resolved lockfile
  sourceRegistryDigest: string;       // digest of config/sources.*.yaml
  crawlPolicyDigest: string;          // digest of config/crawl-policy.yaml
  checkConfigDigest: string;          // digest of config/checks.yaml
  enabledChecks: string[];            // rule IDs active for this run
  portalCount: number;
  portalsSucceeded: number;
  portalsFailed: number;
  portalsPartial: number;
  limitations: string[];
}
```

The four digests together are what §9.4 calls the run's "configuration digest"; keeping them separate lets a reviewer tell *which* input changed between two runs instead of only that something did.

### 5.5 Page observation

```ts
interface PageObservation {
  id: string;
  runId: string;
  portalId: string;
  requestedUrl: string;
  finalUrl?: string;
  discoveredFrom?: string;
  checkedAt: string;
  attempt: number;
  fetchMode: "http" | "browser";
  httpStatus?: number;
  redirectChain: { url: string; status?: number }[];
  contentType?: string;
  durationMs?: number;
  title?: string;
  canonical?: string;
  language?: string;
  bodyDigest?: string;
  errorCode?: string;
  errorMessage?: string;
  robotsDecision: "allowed" | "disallowed" | "not_checked";
  artifactRefs: string[];
}
```

### 5.6 Link observation

```ts
interface LinkObservation {
  id: string;
  runId: string;
  portalId: string;
  sourcePageUrl: string;
  destinationUrl: string;
  normalizedDestinationUrl: string;
  anchorText?: string;
  relationship: "internal" | "external";
  context?: string;
  checkedAt: string;
  status: CheckStatus;
  httpStatus?: number;
  errorCode?: string;
  attempts: number;
}
```

### 5.7 Finding

```ts
interface Finding {
  id: string;
  runId: string;
  portalId: string;
  ruleId: string;
  category:
    | "availability"
    | "broken_link"
    | "https"
    | "freshness"
    | "directory_mismatch"
    | "possible_overlap"
    | "crawl_coverage";
  title: string;
  summary: string;
  severity: Severity;
  confidence: Confidence;
  checkStatus: CheckStatus;
  reviewStatus: ReviewStatus;
  firstObservedAt: string;
  lastObservedAt: string;
  evidenceRefs: string[];
  affectedUrls: string[];
  suggestionRuleId: string;
  suggestedAction: SuggestedAction;
  overlapComparisonId?: string;      // required when category === "possible_overlap"
  reviewerRationale?: string;
  limitations: string[];
}
```

### 5.8 Evidence artifact

Every `evidenceRefs` and `artifactRefs` value elsewhere in this schema points to the `id` of an `EvidenceArtifact`. Nothing may cite evidence that isn't one of these records — the publication gate in §8.3 ("its evidence references resolve") is only checkable if evidence is itself a typed, storable record rather than a loose path string.

```ts
type EvidenceType =
  | "http_response_snapshot"
  | "screenshot"
  | "text_excerpt"
  | "redirect_chain"
  | "certificate_detail"
  | "directory_listing"
  | "link_check_result"
  | "manual_note";

interface EvidenceArtifact {
  id: string;
  runId: string;
  portalId: string;
  type: EvidenceType;
  capturedAt: string;
  sourceUrl?: string;
  relatedObservationId?: string;     // PageObservation.id or LinkObservation.id, when applicable
  storagePath: string;               // path under data/evidence/
  contentDigest: string;             // hash of the stored artifact, for integrity checking
  mimeType?: string;
  description: string;               // plain-language caption; editorially reviewed, not raw scrape output
  privacyReviewed: boolean;
  privacyReviewedAt?: string;
  privacyReviewer?: string;
  redactions?: string[];             // what was removed before storage, if anything
}
```

An `EvidenceArtifact` with `privacyReviewed: false` may exist in `data/evidence/` for internal use but must never be reachable from a published finding — add this as an explicit publication-gate check alongside §8.3's other conditions.

### 5.9 Portal overlap comparison

Structured record backing the manual-review-first process in §7.6. This is what `Finding.overlapComparisonId` points to, and it is what makes `possible_overlap` publishable per the invariant in §5.14 ("`possible_overlap` cannot be published without a completed structured comparison").

```ts
interface PortalOverlapComparison {
  id: string;
  runId: string;
  portalIdA: string;
  portalIdB: string;
  status: "completed";
  reviewedAt: string;
  reviewer: string;
  intendedUserA: string;
  intendedUserB: string;
  serviceOrTaskA: string;
  serviceOrTaskB: string;
  jurisdictionA?: string;
  jurisdictionB?: string;
  transactionStageA?: string;
  transactionStageB?: string;
  responsibleAuthorityA?: string;
  responsibleAuthorityB?: string;
  linksOrRedirectsBetween: boolean;
  materialSimilarities: string[];
  materialDifferences: string[];
  conclusion: "possible_overlap" | "distinct" | "insufficient_evidence";
  uncertaintyNote: string;
  evidenceRefs: string[];
}
```

The `conclusion` enum is the mechanism that forbids the automated `duplicate`/`redundant` outcomes banned in §7.6 — those strings are not valid values, so no code path can emit them even by mistake.

### 5.10 Published portal assessment

```ts
interface PublishedPortalAssessment {
  portal: Portal;
  auditRunId: string;
  technicalHealth: TechnicalHealth;
  continuingRole: ContinuingRole;
  suggestedAction: SuggestedAction;
  criticalFindingCount: number;
  significantFindingCount: number;
  advisoryFindingCount: number;
  crawlCoverage: {
    pagesAttempted: number;
    pagesObserved: number;
    linksChecked: number;
    browserFallbackUsed: boolean;
    coverageNote: string;
  };
  reviewedFindings: Finding[];
  lastCheckedAt: string;
}
```

### 5.11 Human review record

Review data must be separate from generated observations so reruns cannot overwrite editorial work.

```ts
interface ReviewDecision {
  findingId: string;
  decision: "publish" | "reject" | "needs_more_evidence";
  reviewedAt: string;
  reviewer: string;                 // case-study author identifier, not secret PII
  rationale: string;
  overriddenSeverity?: Severity;
  overriddenAction?: SuggestedAction;
}
```

### 5.12 Citizen-experience submission

Experience records are anonymous. The public form must use structured choices wherever possible and make free text optional. Do not collect a name, email address, telephone number, government ID, application/reference number, account identifier, attachment, or exact home/work address.

```ts
type ExperienceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_redaction";

type TaskOutcome =
  | "completed"
  | "partially_completed"
  | "not_completed"
  | "information_only";

type ExperienceTheme =
  | "availability"
  | "navigation"
  | "content_clarity"
  | "outdated_information"
  | "login_or_otp"
  | "form_or_validation"
  | "payment"
  | "document_upload"
  | "mobile_usability"
  | "language"
  | "accessibility"
  | "support"
  | "other";

interface ExperienceSubmission {
  id: string;
  portalId: string;
  createdAt: string;
  occurredOn?: string;               // month or date; never infer more precision
  taskType: string;                  // controlled vocabulary plus "other"
  taskDescription?: string;          // short, optional, privacy-screened
  outcome: TaskOutcome;
  themes: ExperienceTheme[];
  deviceType?: "mobile" | "desktop" | "tablet" | "other";
  experienceRating?: 1 | 2 | 3 | 4 | 5;
  freeText?: string;                 // bounded length; moderation required
  consentToPublish: boolean;
  status: ExperienceStatus;
  moderatedAt?: string;
  moderationReasonCode?: string;
  publicText?: string;               // redacted text; never overwrite original
  source: "public_form" | "research_interview";
  privacyFlags: string[];
  duplicateOf?: string;
}
```

Do not store raw IP addresses. If abuse protection requires a network-derived key, immediately transform it into a short-lived, keyed hash, store it separately with an expiry, and never expose it through product queries or analytics. Do not use browser fingerprinting.

### 5.13 Experience aggregate

Only approved experiences may contribute to public aggregates.

```ts
interface PortalExperienceSummary {
  portalId: string;
  approvedExperienceCount: number;
  outcomeCounts: Record<TaskOutcome, number>;
  themeCounts: Partial<Record<ExperienceTheme, number>>;
  ratingCount: number;
  averageRating?: number;
  earliestExperienceDate?: string;
  latestExperienceDate?: string;
  minimumDisplayThresholdApplied: boolean;
  generatedAt: string;
}
```

For very small samples, emphasize the count and individual approved accounts rather than presenting averages as representative. Never present the submission population as a scientific sample of all portal users.

### 5.14 Data invariants

- A published portal must reference at least one inventory source.
- A published finding must reference at least one evidence record, and every referenced `EvidenceArtifact` must have `privacyReviewed: true`.
- `possible_overlap` cannot be published without a completed `PortalOverlapComparison` whose `conclusion` is `possible_overlap`; `Finding.overlapComparisonId` must resolve to that record, the comparison must belong to the finding's `runId`, and the finding's `portalId` must equal either `portalIdA` or `portalIdB`.
- A completed `PortalOverlapComparison` must compare two different existing portals, reference at least one evidence record, and every referenced `EvidenceArtifact` must have `privacyReviewed: true`.
- `portalsSucceeded + portalsFailed + portalsPartial` must equal `AuditRun.portalCount`; `completedAt` is required for every terminal run status, and `completed`, `partial`, and `failed` must be derived consistently from those counts.
- `review_retirement` cannot be generated from technical failure alone.
- `unavailable` requires the configured number of failed attempts.
- `healthy` means no enabled check produced a reviewed critical or significant finding; it does not certify quality or compliance.
- `not_assessable` must include a reason.
- Every exported result must include audit date, methodology version, and limitations.
- Review overrides must preserve the original automated value.
- A submission must reference an existing published portal ID; users cannot introduce arbitrary URLs.
- A submission cannot be publicly returned unless `consentToPublish` is true and `status` is `approved`.
- Original free text and moderator-redacted public text must be stored separately.
- Rejected and pending submissions never contribute to public aggregates.
- Citizen experiences cannot mutate `technicalHealth`, `continuingRole`, audit `severity`, or audit `suggestedAction`.
- Public experience pages must disclose approved submission count, date range, moderation, and sampling limitations.

---

## 6. Crawl policy

### 6.1 Default boundaries

Recommended defaults for the pilot:

- Maximum 40 HTML pages per portal.
- Maximum crawl depth of 2 from the configured start URL.
- Maximum 2 concurrent requests per hostname.
- Minimum 750 ms delay between requests to the same hostname.
- Request timeout of 15 seconds.
- Maximum 3 attempts for availability-critical requests, with backoff.
- Maximum response body size of 5 MB for HTML.
- Follow at most 10 redirects.
- Crawl only HTTP and HTTPS URLs.
- Normalize fragments away; preserve meaningful query parameters only when allowlisted.
- Do not crawl discovered subdomains unless they are already admitted to the portal record.

These values belong in configuration, not hard-coded constants.

### 6.2 Exclusions

Exclude by default:

- login, logout, authentication, and account routes;
- payment and transaction submission routes;
- forms that mutate server state;
- calendars and faceted search traps;
- site search results;
- infinite query combinations;
- mail, telephone, JavaScript, and data URLs;
- large media, executables, and archives;
- documents from recursive page crawling, although directly linked documents may be recorded;
- paths disallowed by the project's crawl policy;
- any page whose access would require bypassing a technical control.

### 6.3 Robots and identification

Use a descriptive user agent with a project information/contact URL once deployed. Record robots decisions. The case study should default to respecting explicit crawl restrictions. If a homepage can be fetched but deeper crawling is disallowed, publish the limited coverage rather than circumventing it.

### 6.4 JavaScript rendering

HTTP parsing is the default. Browser rendering is an allowlisted fallback only when:

- the HTTP response is successful but contains no meaningful navigational content;
- the site is known to render core content client-side; and
- using a browser does not require authentication or bypass controls.

Record when browser fallback was used. Cap browser pages more aggressively because they are expensive and less deterministic.

### 6.5 URL normalization

Normalize consistently:

- lowercase scheme and hostname;
- remove default ports;
- remove fragments;
- resolve relative URLs;
- normalize trailing slashes under a documented policy;
- remove known tracking parameters;
- sort retained query parameters;
- preserve the originally observed URL alongside the normalized URL.

Do not merge URLs solely because their page titles match.

### 6.6 Safe operation

- Use `GET` and optionally `HEAD`; never submit forms.
- Avoid high request rates.
- Never execute downloaded code outside the browser sandbox.
- Never store cookies, tokens, personal information, or form contents.
- Redact accidental secrets from logs and artifacts.
- Do not claim a site is down based on one failed automated request.
- Provide a global kill switch and per-domain disable configuration.

---

## 7. Audit checks and decision rules

Rules must be pure, deterministic functions over observations whenever possible. Each rule needs an ID, description, version, inputs, output, severity logic, limitations, and tests.

### 7.1 Availability and redirects

Record:

- DNS/connect/TLS/timeout failure category;
- HTTP status;
- final URL;
- full redirect chain;
- attempts and timestamps;
- whether failure appeared specific to automation.

Suggested rule examples:

| Rule | Condition | Default result |
|---|---|---|
| `availability.unavailable.v1` | Entry URL fails across 3 spaced attempts | Critical, high confidence |
| `availability.server-error.v1` | Repeated 5xx response | Critical or significant |
| `availability.not-found.v1` | Official entry URL repeatedly returns 404/410 | Critical |
| `redirect.cross-domain.v1` | Final host is outside registered portal hosts | Advisory pending review |
| `availability.automation-blocked.v1` | Bot block/CAPTCHA is detected | Not assessable |

Do not classify `401`, `403`, CAPTCHA, or login requirement as broken without contextual review.

### 7.2 Broken links

- Check deduplicated normalized destinations.
- Preserve every source page and anchor context.
- Retry suspected failures.
- Group identical failed destinations across source pages.
- Give greater severity to prominent service links and links from official directories.

An official page linking to a repeatedly unavailable service can be critical even when the official page itself is healthy.

### 7.3 HTTPS and certificate observations

Check:

- whether HTTP redirects to HTTPS;
- whether the canonical destination uses HTTPS;
- certificate validity as observed by the client;
- hostname mismatch or expiry errors;
- mixed-content references as advisory evidence if reliably detectable.

This is not a security audit. Do not scan ciphers, ports, vulnerabilities, or server configurations beyond what ordinary page access reveals.

### 7.4 Freshness signals

Collect signals, not a definitive portal-wide staleness label:

- explicit last-updated dates;
- dated notices visible on sampled pages;
- expired deadlines or events;
- old officeholder or scheme references when manually verified;
- copyright year as weak evidence only;
- absence of a detectable freshness signal.

Automated output should be `potentially_stale` or `no_freshness_signal`, both pending review. A recent date is not proof of correctness, and an old date is not proof of irrelevance.

### 7.5 Directory mismatch

Detect and publish separately:

- directory entry points to an unavailable destination;
- multiple directory entries appear to represent the same portal;
- a verified official portal is linked from the estate but absent from the selected directory;
- listed name and destination materially disagree;
- directory URL redirects to a different service or unrelated host.

Preserve the directory source and retrieval date.

### 7.6 Functional overlap

This check is manual-review-first. Every comparison must include:

- portal A and portal B;
- intended user;
- service/task offered;
- jurisdiction;
- transaction stage;
- responsible authority;
- whether either portal links or redirects to the other;
- material similarities;
- material differences;
- reviewer conclusion and uncertainty.

Allowed comparison conclusions are `possible_overlap`, `distinct`, and `insufficient_evidence`. Only a completed comparison with the conclusion `possible_overlap` may support a published `possible_overlap` finding. `duplicate` and `redundant` are forbidden conclusions and must never be emitted by automated or manual workflows.

### 7.7 Technical health derivation

- `unavailable`: the portal entry point meets a reviewed unavailability rule.
- `degraded`: at least one reviewed critical/significant technical finding exists, but the portal is reachable.
- `healthy`: no reviewed critical/significant finding exists within the measured coverage.
- `not_assessable`: core access could not be fairly assessed.

The UI must accompany `healthy` with coverage and methodology; it must not imply certification.

### 7.8 Suggested action mapping

Use deterministic templates:

| Evidence | Suggested action |
|---|---|
| Repeatedly unavailable official portal | Investigate hosting, DNS, or domain ownership and restore if still required |
| Official source links to dead destination | Repair, replace, or remove the official link |
| Certificate failure | Renew or correct certificate deployment and verify hostname coverage |
| Substantial broken navigation | Repair affected destinations and add routine link checking |
| Potential staleness | Ask the content owner to verify named content and publish an update signal |
| Directory mismatch | Verify ownership and update the authoritative directory |
| Possible overlap | Review mandate, usage, and service coverage before considering consolidation |
| Apparent obsolete portal plus corroborating evidence | Review retirement; preserve required records and redirects |

Never suggest retirement from downtime alone.

---

## 8. Severity, confidence, and review

### 8.1 Severity

- **Critical:** A portal or essential citizen route is unavailable; an official link leads to a dead essential service; or a comparable failure blocks the primary task.
- **Significant:** Substantial navigation failure, HTTPS/certificate access failure, or verified outdated service information is likely to materially impede users.
- **Advisory:** Directory inconsistency, weak freshness evidence, partial coverage, unusual redirect, or possible overlap requires attention but does not prove immediate user blockage.

### 8.2 Confidence

- **High:** Repeated direct observation with unambiguous evidence.
- **Medium:** Multiple signals support the finding, but context could change the interpretation.
- **Low:** Heuristic or incomplete evidence; must not be framed categorically.

### 8.3 Publication gate

A finding may be published only if:

1. its schema is valid;
2. its evidence references resolve;
3. every referenced `EvidenceArtifact` has `privacyReviewed: true` (automatic pattern detection alone does not satisfy this requirement);
4. its rule and methodology versions exist;
5. repeated-check requirements are satisfied;
6. a review decision is present for interpretive findings;
7. its language follows the editorial policy;
8. no artifact exposes personal or secret information;
9. if it is a `possible_overlap` finding, its completed comparison passes every §5.14 relationship, run, portal, evidence, and conclusion invariant.

### 8.4 Editorial language

Prefer:

- “Unavailable during three checks on [dates].”
- “The official directory linked to a destination that returned [result].”
- “No recent update signal was detected in the sampled pages.”
- “Possible functional overlap; manual mandate and usage review required.”

Avoid:

- “Abandoned,” unless backed by explicit authoritative evidence.
- “Useless,” “obsolete,” or “wasteful.”
- “All pages work” or “the site is secure.”
- Claims about intent, negligence, ownership, or legal status not established by evidence.

---

## 9. Audit CLI design

### 9.1 Commands

```bash
pnpm audit sources:validate
pnpm audit inventory:build --state assam
pnpm audit inventory:validate --state assam
pnpm audit crawl --state assam --run-id <id>
pnpm audit analyze --run-id <id>
pnpm audit review:validate --run-id <id>
pnpm audit publish --run-id <id>
pnpm audit export --run-id <id> --format csv
pnpm audit report --run-id <id>
```

Also provide scoped development commands:

```bash
pnpm audit crawl --portal <portal-id> --max-pages 5
pnpm audit analyze --portal <portal-id> --fixture
```

### 9.2 Command behavior

- Commands must be resumable and idempotent where practical.
- Never silently overwrite a completed run.
- Write atomically: stage output, validate it, then move it into place.
- Exit non-zero on validation failure.
- Emit concise human logs and optional structured JSON logs.
- Record configuration digest and code revision in the run manifest.
- Support `--dry-run` for network operations.
- Support per-portal and global request limits.

### 9.3 Error taxonomy

Use stable internal error codes such as:

- `DNS_FAILURE`
- `CONNECT_TIMEOUT`
- `READ_TIMEOUT`
- `TLS_CERT_EXPIRED`
- `TLS_HOST_MISMATCH`
- `TOO_MANY_REDIRECTS`
- `HTTP_CLIENT_ERROR`
- `HTTP_SERVER_ERROR`
- `ROBOTS_DISALLOWED`
- `AUTOMATION_BLOCKED`
- `AUTH_REQUIRED`
- `UNSUPPORTED_CONTENT`
- `RESPONSE_TOO_LARGE`
- `PARSER_FAILURE`
- `INTERNAL_AUDIT_ERROR`

User-facing text should translate these codes into plain language.

### 9.4 Reproducibility

Every run manifest should contain:

- audit run ID;
- UTC start/end times;
- Git commit when available;
- Node and package versions;
- source registry digest;
- crawl-policy digest;
- check configuration digest;
- enabled checks;
- portal count;
- success/failure/partial counts;
- known limitations.

Network observations will naturally change; reproducibility means the method and inputs are inspectable, not that the web will return identical results.

### 9.5 Database setup and lifecycle

The database exists only for citizen-experience submissions, moderation state, public experience reads, and short-lived abuse controls. Do not move audit observations into PostgreSQL during version one.

Use these tables:

- `experience_submissions`: immutable original structured answers and optional original text;
- `experience_moderation`: decision, reason code, redacted public text, and moderation timestamps;
- `experience_abuse_keys`: short-lived keyed hashes and counters with automatic expiry;
- `experience_schema_meta`: migration/schema compatibility metadata.

Database requirements:

- UUID primary keys generated server-side;
- foreign-key validation of `portal_id` against a synchronized published-portal registry or equivalent application validation;
- UTC timestamps;
- explicit check constraints for ratings, outcomes, consent, and statuses;
- indexes on `portal_id`, `status`, `created_at`, and moderation queue ordering;
- migration files committed to Git;
- separate local, test, preview, and production databases;
- automated backup capability documented for production;
- retention job/command for expired abuse keys and rejected submissions according to policy;
- seed command for deterministic development/test submissions;
- no production submission data committed to Git.

Required commands:

```bash
pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:seed
pnpm db:studio                 # local development only
pnpm experiences:queue
pnpm experiences:moderate --id <id> --decision <decision>
pnpm experiences:aggregate
pnpm experiences:retention
```

`db:down` must not delete volumes by default. Any destructive reset must be a separate, clearly named local-only command.

### 9.6 Submission API

Recommended routes:

- `POST /api/experiences`: validate and create a pending anonymous submission;
- `GET /api/portals/:portalId/experiences`: return approved, redacted, paginated experiences and aggregates;
- `GET /api/portals/:portalId/experience-options`: optional route for portal-specific task choices, or serve these choices statically.

There is deliberately no public moderation API and no authentication system. Moderation happens through a local/controlled CLI connected to the database. If remote moderation is later required, that is a new authenticated feature and is out of scope.

**Default abuse-control and content boundaries** (pilot defaults; belong in configuration, not hard-coded constants, mirroring §6.1):

- `taskDescription` capped at 280 characters; `freeText` capped at 1,000 characters. Reject submissions over the limit with a field-level error; never silently truncate.
- Request body capped at 8 KB.
- Rate limit: maximum 5 submissions per abuse key per rolling 24 hours across all portals, and maximum 2 submissions per abuse key per portal per rolling 24 hours.
- Abuse key: stable HMAC of the request IP using a server-side secret; store only the resulting hash in `experience_abuse_keys` with timestamped counters/events and a short expiry, never the raw IP (per §5.12's ban on storing raw IP addresses). Do not include a calendar-day bucket in the key because that would not enforce a rolling 24-hour limit across midnight.
- Treat the network-derived limit as one privacy-preserving abuse signal, not as identity: shared NAT addresses can combine unrelated visitors and IPv6 address rotation can weaken IP-only limiting. Layer it with the honeypot and duplicate checks, and return a generic rate-limit response with a retry time without exposing key details.
- Duplicate detection: within a 10-minute window, a new submission matching an existing pending/approved submission on the same abuse key, `portalId`, `taskType`, normalized `taskDescription`, `outcome`, normalized/sorted `themes`, month-rounded `occurredOn`, and normalized `freeText` is marked `duplicateOf` rather than queued as a fresh independent report. Different narratives sharing only the same structured choices are not duplicates.
- Privacy-pattern flags must check, at minimum: email addresses; Indian mobile numbers beginning 6–9 and written as 10 digits or in common `+91`/space/hyphen forms; Aadhaar-shaped 12-digit sequences; PAN-shaped 10-character alphanumeric sequences using token boundaries and case normalization; and other long numeric runs (8+ digits) that could be reference, application, or account numbers. These matches create moderation flags rather than proving validity or causing automatic rejection; optional Verhoeff validation may reduce Aadhaar false positives but must not replace the broad shape check.
- Paginated reads (`GET /api/portals/:portalId/experiences`) default to 10 items per page, maximum 50.

Submission behavior:

1. Confirm that `portalId` belongs to the published inventory.
2. Enforce content type and a small request-body limit.
3. Validate the shared Zod schema.
4. Reject honeypot completion.
5. Apply network-derived and portal-level rate limits without retaining raw IP addresses.
6. Normalize bounded free text; never accept HTML.
7. Run privacy-pattern flags for likely phone, email, identity, reference, or payment data.
8. Store as `pending` even if no privacy flag is detected.
9. Return a generic receipt message; do not expose moderation or abuse signals.

The endpoint must not promise a government response. Suggested confirmation text:

> Thank you. Your experience has been submitted for review. Panchnama is an independent research prototype and cannot resolve or forward individual service complaints.

### 9.7 Moderation policy

Approve only submissions that:

- describe a first-hand or clearly attributed portal experience;
- relate to the selected portal;
- contain no personal, identity, application, payment, or confidential information;
- do not include threats, abuse, spam, promotional content, or unverifiable accusations about individuals;
- are understandable enough to categorize;
- include consent to publish.

Moderators may redact personal information and publish `publicText`, but must not silently rewrite meaning. Store a reason code for approval, rejection, duplication, or redaction. The public UI must say experiences are moderated for relevance, privacy, and safety—not verified as universally representative facts.

### 9.8 Failure and privacy behavior

- If the database is unavailable, the audit scorecard remains readable and the form shows an honest temporary-unavailability state.
- Never queue submissions only in browser storage as if successfully received.
- Do not include third-party analytics on form text or submission payloads.
- Do not log request bodies.
- Scrub framework error reporting so free text cannot reach telemetry.
- Add CSRF/origin protections appropriate to the deployment model even without authentication.
- Define retention before launch: recommended starting policy is to delete rejected original submissions after 90 days and expired abuse keys within 24 hours, while retaining approved public records until withdrawn or superseded.
- Provide a contact route for requesting removal of a published experience, without requiring an account.

---

## 10. Public scorecard information architecture

### 10.1 Global requirements

Every page should make these facts easy to find:

- this is an independent case-study prototype;
- the audit date;
- what was and was not checked;
- the observed-estate definition;
- a link to methodology;
- a link to download the dataset;
- limitations and `Not assessable` treatment.

### 10.2 Assam overview

Purpose: help a reviewer understand the portfolio and choose where to investigate.

Include:

- concise project proposition;
- audit date and estate coverage;
- counts by technical health;
- counts by severity and suggested action;
- top priority findings;
- directory mismatch summary;
- coverage/limitations callout;
- entry points to inventory, methodology, and export.

Do not include a composite score, vanity chart, state ranking, or unsupported “money saved” estimate.

### 10.3 Website inventory

Columns/cards:

- website name and department;
- canonical host;
- technical health;
- continuing role;
- suggested action;
- highest severity;
- reviewed finding count;
- last checked;
- coverage note.

Filters:

- technical health;
- suggested action;
- severity;
- department;
- portal type;
- assessment availability.

Search by website, department, and domain. Filters and sorting should be reflected in the URL when feasible.

### 10.4 Portal detail

Include:

- portal identity and official-source provenance;
- plain-language assessment summary;
- technical health, continuing role, and suggested action as distinct fields;
- audit timestamp and coverage;
- findings grouped by severity/category;
- affected URLs and source pages;
- attempts and observations;
- screenshots or text evidence where useful;
- suggested next action;
- limitations and review status;
- related/possibly overlapping portals when reviewed.
- a clearly separate citizen-experience summary and approved-experiences section;
- an entry point to share an experience about this portal.

Do not embed or iframe the government portal.

### 10.5 Share-an-experience flow

The form is always anchored to an existing portal; users cannot submit a website URL. Use a short, staged form:

1. **Context:** portal name, approximate date/month, task attempted, and device type.
2. **Outcome:** completed, partially completed, not completed, or information only.
3. **What happened:** one or more structured themes, optional 1–5 experience rating, and bounded optional free text.
4. **Privacy and consent:** explicit warning not to include personal/reference/payment information, confirmation that this is not an official grievance channel, and consent to publish after moderation.
5. **Review and submit:** show entered information and allow editing.

Form requirements:

- no name, email, phone, identity, application number, account, file upload, or login field;
- clear character limits and inline validation;
- accessible error summary and field-level messages;
- a honeypot invisible to assistive technology and ordinary users;
- double-submit prevention;
- success state that does not imply acceptance or government response;
- database/API failure state that preserves non-sensitive selections for retry during the current page session only;
- links to privacy, moderation, methodology, and official grievance guidance where appropriate.

### 10.6 Citizen-experience section

Show citizen experiences below and visually separate from the technical audit. Include:

- approved submission count and covered date range;
- outcome distribution;
- most frequently selected themes;
- rating only when sample size is sufficient, always paired with count;
- approved redacted accounts, paginated or progressively disclosed;
- moderation and sampling disclaimer;
- empty state inviting the first experience without implying no one has had problems;
- report/removal contact route.

Use language such as “Experiences shared with Panchnama,” not “verified complaints.” Never blend experience counts into technical severity or health.

### 10.7 Methodology

Include:

- observed-estate inclusion rules;
- inventory sources;
- crawl boundaries;
- check definitions;
- severity and confidence rules;
- human review process;
- evidence retention approach;
- known limitations;
- methodology version history;
- ethical and unofficial-use disclaimer.
- experience-submission, privacy, moderation, aggregation, retention, and non-representative-sample policies.

### 10.8 Exports

Provide:

- `audit-summary.json`
- `portals.json`
- `findings.json`
- a flattened `assam-audit.csv`
- `methodology.json` or embedded version metadata

CSV fields should remain analysis-friendly. Arrays should either be flattened deliberately or excluded in favor of counts and canonical URLs.

Approved experiences should have a separate public export only if privacy review and product research justify it. Do not include original text, rejected/pending records, abuse keys, moderator identity, or internal moderation notes in any public export.

### 10.9 Accessibility and responsive behavior

- Meet WCAG 2.2 AA for the scorecard interface where feasible.
- Full keyboard navigation and visible focus.
- Semantic headings, landmarks, tables, and status text.
- Do not communicate status by color alone.
- Charts, if any, require adjacent text/table equivalents.
- Respect reduced-motion preferences.
- Support 320 px width without horizontal page overflow; wide data tables may use an explicitly labeled scroll container or card transformation.
- Use plain English and explain audit terminology.

### 10.10 Visual direction

The interface should feel like an evidence register: sober, legible, calm, and specific. Avoid copying Assam government branding, national emblems, or a visual treatment that implies official ownership. Use a clearly independent wordmark and disclaimer.

---

## 11. Testing strategy

### 11.1 Test pyramid

**Unit tests**

- URL normalization;
- scope decisions;
- error classification;
- availability rules;
- broken-link grouping;
- severity/confidence mapping;
- technical-health derivation;
- suggestion mapping;
- Zod schemas;
- publication invariants.

**Fixture-site integration tests**

Create local deterministic sites representing:

- healthy HTML portal;
- redirect chain;
- redirect loop;
- 404 entry point;
- intermittent 500 response;
- slow timeout;
- broken internal link;
- broken external link;
- login wall;
- robots exclusion;
- client-rendered navigation;
- crawl trap/calendar URLs;
- duplicate normalized URLs;
- oversized/non-HTML response.

Never make CI depend on live government websites.

**Pipeline contract tests**

- source registry → inventory;
- inventory → crawl output;
- observations → candidate findings;
- findings + reviews → publication dataset;
- publication dataset → static build.
- submission request → pending database row;
- CLI moderation → approved public read;
- rejection/redaction → correct visibility and preserved original;
- approved experiences → portal aggregate, with no audit-status mutation.

**Database and API integration tests**

- migrations apply cleanly to an empty database;
- constraints and indexes match the domain invariants;
- test isolation and transaction cleanup;
- submission validation, origin protection, body limit, honeypot, and rate limits;
- no raw IP address or request body appears in persistence/logs;
- pending and rejected experiences are absent from public reads;
- approved redacted text is returned instead of original text;
- retention removes only eligible records;
- database failure does not break static audit pages.

**Frontend component tests**

- status presentation includes text;
- filters compose correctly;
- empty/not-assessable states;
- evidence lists;
- provenance display;
- long domains and titles;
- missing optional metadata.
- experience form validation and consent;
- experience aggregation, empty, small-sample, loading, and unavailable states.

**End-to-end tests**

1. Open overview and verify audit context.
2. Filter to critical findings.
3. Open a portal.
4. inspect evidence and suggested action.
5. navigate to source and methodology.
6. download an export.
7. verify deep-linked filter state.
8. Submit a valid anonymous experience and verify the pending confirmation.
9. Confirm it is not publicly visible before moderation.
10. Approve it through the test moderation path and verify it appears only on the correct portal.

**Accessibility tests**

- automated axe scan;
- keyboard-only walkthrough;
- focus order;
- screen-reader-friendly status text;
- contrast checks;
- 200% zoom and narrow viewport.

### 11.2 Live audit smoke tests

Live network tests should be opt-in and excluded from ordinary CI. They verify that:

- a small configured portal set can be fetched;
- raw output validates;
- rate limiting works;
- failures are recorded without crashing the run;
- reruns create new observations rather than overwriting old ones.

### 11.3 Quality gates

Before merging any session:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

After UI work, also run the relevant Playwright and accessibility tests.

Before publishing an audit:

```bash
pnpm audit sources:validate
pnpm audit inventory:validate --state assam
pnpm audit review:validate --run-id <id>
pnpm audit publish --run-id <id>
pnpm build
```

---

## 12. Security, ethics, and responsible publication

### 12.1 Threat boundaries

- Treat all crawled HTML and metadata as untrusted input.
- Never render captured HTML directly in the scorecard.
- Escape displayed titles, snippets, and URLs.
- Prevent spreadsheet formula injection in CSV fields beginning with `=`, `+`, `-`, or `@`.
- Validate artifact paths to prevent traversal.
- Restrict fetched schemes to HTTP/HTTPS.
- Block requests to loopback, link-local, private, and metadata-service IP ranges to mitigate SSRF if URLs ever become configurable by untrusted users.
- Limit response sizes and parsing time.
- Keep browser execution isolated and ephemeral.

### 12.2 Publication review

Before publishing screenshots or extracted text:

- check for personal information;
- remove tokens, session identifiers, email addresses where unnecessary, and accidental secrets;
- avoid capturing form values or user-specific content;
- confirm the evidence is necessary for the claim;
- retain only what the case study needs.

### 12.3 Disclaimer

Use a visible statement similar to:

> Panchnama is an independent case-study prototype and is not affiliated with or endorsed by the Government of Assam. Findings describe observations made at the stated times and within the published audit coverage. They are not legal, security, accessibility, or policy determinations.

### 12.4 Correction path

Even without building a correction workflow, publish a contact method in the final case-study deployment. Record corrections in the dataset and changelog rather than silently editing historical observations.

### 12.5 Legal-risk and live-crawl approval gate

Everything in §12.1–§12.3 addresses *ethical* conduct — robots.txt, no auth bypass, no vulnerability scanning. It does not establish *legal* authorization, and the two are not the same thing. Panchnama is an unaffiliated party running an automated crawler against Government of Assam infrastructure; even a polite, read-only, robots-respecting crawler can carry legal exposure (terms-of-use violations, unauthorized-access statutes, or departmental objection after the fact) that ethical care alone does not resolve.

Before Session 17 (the first run against real, non-fixture Assam government sites) begins:

- Record an ADR describing the legal basis and risk assessment relied on — e.g., all targets are unauthenticated public pages accessed via ordinary `GET` at politeness levels no more aggressive than a standard search-engine crawler, per §6.1–§6.6 — and any jurisdiction-specific statute considered (India's IT Act and any relevant computer-misuse provisions). The ADR documents a decision; it does not itself create legal authorization.
- Maintain an approved target-host register recording each host's terms of use, robots policy, intended request volume, owner/contact route when identifiable, and include/exclude decision.
- Get a documented live-crawl sign-off before Session 17 sends its first request to a live `.gov.in`/`.assam.gov.in` host. For ordinary low-volume public `GET` requests where neither terms nor law creates identified ambiguity, the case-study author's recorded risk acceptance is sufficient for this prototype. If terms prohibit automation, authorization is uncertain, or the proposed activity goes beyond that narrow profile, exclude the host unless written authorization or qualified Indian legal review supports proceeding.
- Approve the 3–5 portal smoke crawl separately; review its request logs, target responses, objections, and safety behavior before authorizing the estate-wide run.
- Keep §6.6's kill switch ready and rehearsed: know how to halt the run against a specific domain immediately if a department objects during or after the pilot.
- Record who can stop the crawl and the contact/escalation procedure for objections or unexpected impact.

This gate is a prerequisite check for Session 17, not a new development session — it should take an afternoon, not a sprint. But it must happen before, not after, the first live request.

---

## 13. Research and case-study evidence plan

Keep research evidence distinct from product-generated evidence.

### 13.1 Problem evidence

Collect and cite:

- official counts/directories used to frame the estate;
- verified examples of official pages pointing to non-functional destinations;
- directory mismatches found during the pilot;
- evidence of parallel portals, presented cautiously;
- any authoritative descriptions of departmental website responsibility.

Avoid unprovable absolutes such as “no audit has ever existed” or “nobody checks.” Prefer:

> No publicly identifiable, continuously maintained inventory and evidence-backed health assessment covering the observed Assam citizen-facing web estate was found during this research.

### 13.2 User validation

If possible, conduct 2–3 interviews with government technologists, former public-sector staff, civic-tech practitioners, or people managing large web estates. Test:

- whether the portfolio view matches their mental model;
- what evidence they require before acting;
- whether severity and suggested actions are understandable;
- whether ownership/provenance fields are sufficient;
- what would cause them to distrust a finding.

If direct access is unavailable, use informed proxies and label the limitation explicitly.

### 13.3 Usability validation

Give participants these tasks:

1. Identify the three portals that need attention first.
2. Explain why one portal was flagged.
3. Distinguish a confirmed failure from a possible overlap.
4. Find where the portal was identified as official.
5. State the recommended next action and its limitation.

Capture task completion, time, errors, and comprehension. Do not rely only on preference questions.

### 13.4 International precedent

Use NSW only to support the sequencing principle: diagnose the estate before consolidation. Mention GOV.UK primarily to distinguish this bounded diagnostic from a national platform rebuild. Verify and cite claims in the final case study.

---

## 14. Session-by-session development plan

### How to use these sessions

Each session is designed to fit one focused AI coding conversation. Start each session by giving the AI:

1. this `implementation.md` file;
2. the repository state;
3. the named session only;
4. instructions to inspect existing work before editing;
5. instructions not to implement future sessions;
6. instructions to run the session's verification commands;
7. instructions to update `docs/session-log.md` with decisions, tests, and remaining issues.

Do not begin a session until the previous session's exit criteria pass. If an AI discovers a prerequisite defect, it may fix that defect but must document the scope change.

---

### Session 0 — Repository bootstrap and governance

**Goal:** Create a stable monorepo foundation and contributor instructions.

**Implement:**

- Initialize Git if it is not already initialized.
- Create pnpm workspace and root scripts.
- Configure strict TypeScript, ESLint, Prettier, Vitest, and shared tsconfig.
- Create the proposed directory structure.
- Add Node/pnpm engine constraints.
- Add `.editorconfig`, `.gitignore`, and environment example if needed.
- Add `README.md` with product summary and local commands.
- Add `AGENTS.md` with repository-specific rules for Codex/Claude-style agents.
- Create `docs/session-log.md` and ADR template.
- Add a minimal CI workflow for install, lint, typecheck, test, and build.

**Do not:** Build the crawler or UI.

**Tests:** Run install, lint, typecheck, empty test suite, and workspace build.

**Exit criteria:** A clean checkout can install and run all root quality scripts; package boundaries are established.

**Suggested commit:** `chore: bootstrap Panchnama monorepo`

---

### Session 1 — Domain schemas and fixtures

**Goal:** Make the data contract executable before writing crawler or UI code.

**Implement:**

- Create `packages/schema`.
- Implement all enumerations and Zod schemas in section 5.
- Add schema-version constants and migration placeholder conventions.
- Add stable ID helpers where appropriate.
- Create valid example fixtures for sources, portals, runs, observations, evidence artifacts, findings, overlap comparisons, reviews, and published assessments.
- Create deliberately invalid fixtures for every important invariant.
- Write `docs/data-dictionary.md` generated from or synchronized with schemas.

**Tests:** Schema parsing, invalid cases, discriminated unions, unknown-field policy, serialized round trips.

**Exit criteria:** All example datasets validate; invalid cases fail with useful paths/messages; no package duplicates domain types.

**Suggested commit:** `feat(schema): define versioned audit data contracts`

---

### Session 2 — Configuration and source registry

**Goal:** Represent inventory provenance and audit configuration reproducibly.

**Implement:**

- Define schemas for source, crawl, check, and portal override configuration.
- Add YAML parsing and semantic validation.
- Create `config/sources.assam.yaml` with placeholders or verified initial sources.
- Create default crawl/check policy files.
- Add source snapshot metadata conventions.
- Implement `sources:validate`.
- Document how to add sources without editing code.

**Tests:** Missing/duplicate IDs, invalid URLs, unsupported geography, bad thresholds, conflicting overrides, deterministic config digest.

**Exit criteria:** Configuration validates independently; invalid configuration prevents network activity.

**Suggested commit:** `feat(config): add validated Assam source registry and policies`

---

### Session 3 — Inventory ingestion and normalization

**Goal:** Generate a provenance-rich portal inventory from source inputs.

**Implement:**

- Build adapters for curated seed HTML/JSON/CSV inputs first.
- Extract candidate portal links and labels.
- Implement URL normalization and hostname handling.
- Preserve every discovery route.
- Deduplicate conservatively using canonical URLs and reviewed aliases.
- Support `verified`, `unverified`, and `disputed` status.
- Implement `inventory:build` and `inventory:validate`.
- Output a human-reviewable candidate inventory.

**Tests:** Relative URLs, redirects represented in seed data, duplicate hosts, alternate protocols, malformed URLs, conflicting labels, provenance preservation.

**Exit criteria:** A deterministic seed fixture produces the expected inventory; no candidate loses its source provenance.

**Suggested commit:** `feat(inventory): build provenance-aware portal registry`

---

### Session 4 — Safe fetcher and crawl frontier

**Goal:** Build the bounded, polite HTTP acquisition layer.

**Implement:**

- HTTP fetcher with timeouts, response limits, redirects, retry/backoff, and typed errors.
- Per-host concurrency and delay controls.
- URL scope and exclusion rules.
- Crawl frontier with maximum pages and depth.
- Robots decision recording.
- Content-type filtering.
- Run manifest creation, resumable output conventions, and atomic writes.
- SSRF protections for configurable URLs.
- `--dry-run`, portal scoping, and kill switch.

**Tests:** Use local fixture servers for status codes, delays, loops, oversized bodies, private IP restrictions, and scope boundaries.

**Exit criteria:** The crawler cannot exceed configured boundaries; one portal failure does not stop the run; observations validate against schemas.

**Suggested commit:** `feat(crawler): add bounded and safe HTTP crawl engine`

---

### Session 5 — HTML extraction and link checking

**Goal:** Turn fetched pages into normalized page and link observations.

**Implement:**

- Parse title, canonical, language, links, limited context, and visible date candidates.
- Resolve and normalize URLs.
- Classify internal/external links.
- Deduplicate destination checks while retaining all source occurrences.
- Check links with appropriate GET/HEAD fallback behavior.
- Group repeated failures by destination.
- Avoid mail, tel, script, fragment-only, and excluded routes.

**Tests:** Malformed HTML, base tags, relative links, encoded URLs, anchors, tracking parameters, repeated destinations, false HEAD failures, non-HTML targets.

**Exit criteria:** Fixture crawl produces complete traceability from failed destination to all source pages and anchors.

**Suggested commit:** `feat(crawler): extract pages and verify discovered links`

---

### Session 6 — Browser fallback

**Goal:** Assess explicitly allowlisted client-rendered portals without making browser automation the default.

**Implement:**

- Playwright fetch adapter behind a common observation interface.
- Portal-level configuration enabling browser fallback.
- Detection heuristic for empty client-rendered shells, with manual override.
- Strict page/time/resource caps.
- Artifact capture for selected evidence only.
- Authentication/CAPTCHA/block detection resulting in `not_assessable`.

**Tests:** Local JavaScript-rendered fixture, client redirect, CAPTCHA-like block fixture, timeout, resource cap, equivalent schema output across fetch modes.

**Exit criteria:** Browser fallback works for a configured fixture and never activates globally without policy approval.

**Suggested commit:** `feat(crawler): add allowlisted browser rendering fallback`

---

### Session 7 — Deterministic audit rules

**Goal:** Convert raw observations into explainable candidate findings.

**Implement:**

- Create rule registry with IDs and versions.
- Implement availability, redirects, broken-link, HTTPS, crawl-coverage, and directory-mismatch rules.
- Implement cautious freshness-signal extraction as review-required output.
- Implement severity and confidence mapping.
- Implement technical-health derivation.
- Implement deterministic suggestion templates.
- Materialize typed `EvidenceArtifact` records for generated finding evidence and ensure every generated `evidenceRefs` value resolves to one of them.
- Implement `analyze` command.

**Tests:** Table-driven test cases for every rule boundary; regression snapshots for generated finding language; ensure downtime never triggers retirement.

**Exit criteria:** Every candidate finding explains its rule, inputs, evidence, severity, confidence, limitations, and suggestion.

**Suggested commit:** `feat(audit): generate explainable evidence-backed findings`

---

### Session 8 — Review and publication pipeline

**Goal:** Create the offline human-review gate and stable public datasets.

**Implement:**

- Review-decision files separate from raw/generated data.
- CLI output listing findings awaiting review.
- `review:validate` with publication invariants.
- Structured possible-overlap comparison workflow using the section 5 schema.
- Publication transformer producing portal assessments and summary counts.
- JSON and safe CSV exports.
- Atomic publication output and audit manifest.
- Validation that no interpretive finding bypasses review.

**Tests:** Missing or unreviewed evidence, stale review references, rejected findings, reviewer overrides, cross-run overlap comparisons, invalid or identical portal pairs, empty comparison evidence, non-publishable overlap conclusions, formula injection, deterministic output ordering, and summary count integrity.

**Exit criteria:** Only eligible reviewed findings appear in published data; a rerun cannot overwrite review decisions silently.

**Suggested commit:** `feat(publish): add editorial review and static export pipeline`

---

### Session 9 — Database foundation and moderation storage

**Goal:** Add a production-shaped PostgreSQL persistence layer for anonymous experience submissions without moving audit data into the database.

**Implement:**

- Add `packages/database` with Drizzle schema and typed repository functions.
- Add Docker Compose for a pinned local PostgreSQL service with health check and persistent named volume.
- Add environment validation and `.env.example`; never commit credentials.
- Create tables, constraints, indexes, and the first committed migration for submissions, moderation records, abuse keys, and schema metadata.
- Implement database connection lifecycle for CLI, tests, and Next.js runtime.
- Add idempotent development seed data tied to fixture portal IDs.
- Add `db:up`, `db:down`, `db:generate`, `db:migrate`, `db:check`, and `db:seed` commands.
- Implement repository methods for create pending submission, list moderation queue, record decision/redaction, fetch approved portal experiences, aggregate approved experiences, and enforce retention.
- Implement an offline moderation CLI; do not create a web admin or authentication system.
- Document local, test, preview, and production database configuration, backup expectations, and non-destructive reset behavior.

**Do not:** Store crawler/audit observations in PostgreSQL, build the public form, expose moderation over HTTP, or add user authentication.

**Tests:** Migration from an empty database, constraints, transaction rollback, repository queries, approval visibility, redaction preservation, aggregate exclusion of pending/rejected records, retention, and concurrent decision handling. Use an isolated test database.

**Exit criteria:** A clean developer environment can start PostgreSQL, apply migrations, seed data, run repository tests, moderate a fixture submission through the CLI, and stop the service without deleting data.

**Suggested commit:** `feat(database): add anonymous experience persistence and moderation`

---

### Session 10 — Application runtime, anonymous experience API, and abuse controls

**Goal:** Create the safe server-side contract for submitting structured experiences and reading approved experiences.

**Implement:**

- Create the minimal Next.js application/runtime shell needed to host server routes if it does not yet exist; defer visual scorecard work to Session 11.
- Add shared request/response schemas and controlled task/theme options.
- Implement `POST /api/experiences` with portal validation, body limit, origin/CSRF protection, honeypot, rate limiting, privacy flags, duplicate signals, safe logging, and generic receipt response.
- Implement approved-only paginated read API and aggregate query for each portal.
- Prevent experience data from entering audit health, severity, role, or action calculations.
- Add privacy and moderation policy documentation plus a removal/contact procedure placeholder.

**Do not:** Add authentication, profiles, visual scorecard pages, file uploads, arbitrary URL submissions, comments/replies, government case tracking, automatic public posting, or a web moderation panel.

**Tests:** API schema and portal validation, honeypot, rate limit, origin protection, privacy flags, body size, safe logging, approved-only reads, pagination, aggregates, database outage, and proof that audit status is unchanged by experiences.

**Exit criteria:** The API accepts a valid privacy-minimized experience for a known portal, keeps it invisible until CLI approval, and returns only approved/redacted experiences through public reads.

**Suggested commit:** `feat(experiences): add anonymous moderated submission API`

---

### Session 11 — Frontend foundation and design system

**Goal:** Extend the application runtime into the public scorecard shell and accessible UI language.

**Implement:**

- Complete the Next.js scorecard app around the existing runtime/API shell.
- Load validated local published fixtures at build time.
- Define typography, spacing, color, borders, status tokens, and responsive breakpoints.
- Create layout, header, footer, audit-context banner, independent-project disclaimer, status badge, severity marker, evidence callout, and empty/error states.
- Add metadata, favicon/wordmark, and basic SEO/social metadata without implying official authority.
- Build a component documentation page or Storybook only if it adds more value than maintenance cost.

**Tests:** Component tests, axe checks, keyboard behavior, responsive smoke tests, build with valid/invalid data.

**Exit criteria:** Static build succeeds from fixtures; components communicate statuses without relying on color.

**Suggested commit:** `feat(web): establish accessible scorecard foundation`

---

### Session 12 — Assam overview

**Goal:** Let users understand the audit and identify priority areas quickly.

**Implement:**

- Hero proposition and audit metadata.
- Coverage summary.
- Technical-health, severity, and action counts.
- Priority findings list.
- Directory mismatch summary.
- Limitations callout.
- Links to inventory, methodology, and downloads.
- Thoughtful empty and partial-audit states.

**Tests:** Correct derived counts, no composite score, links, narrow viewport, partial datasets, no-findings dataset.

**Exit criteria:** A new user can state what was audited, when, the major result, and where to investigate next.

**Suggested commit:** `feat(web): build Assam audit overview`

---

### Session 13 — Inventory exploration

**Goal:** Make the estate searchable and prioritizable without overwhelming the user.

**Implement:**

- Inventory table/card-responsive layout.
- Search, filters, sorting, result count, and clear-all.
- URL-backed filter state.
- Accessible table semantics or explicit mobile card alternative.
- Department/domain handling for missing or long values.
- Links to portal details.

**Tests:** Filter combinations, URL restoration, keyboard use, empty results, large fixture dataset, long strings, mobile behavior.

**Exit criteria:** Users can isolate critical/unavailable/repair candidates and retain a shareable filtered URL.

**Suggested commit:** `feat(web): add searchable portal inventory`

---

### Session 14 — Portal evidence pages

**Goal:** Make each assessment understandable, traceable, and challengeable.

**Implement:**

- Static route per portal.
- Identity, department, domain, and official-source provenance.
- Separate health, role, and suggested-action presentation.
- Crawl coverage and audit timestamp.
- Findings grouped by severity/category.
- Evidence details with affected/source URLs, attempts, observations, and artifacts.
- Review status, confidence, limitations, and related overlap comparisons.
- Safe external-link behavior.

**Tests:** Portal with many findings, no findings, not assessable, missing optional metadata, multiple sources, rejected/unpublished evidence exclusion.

**Exit criteria:** A reviewer can explain exactly why a portal was flagged without consulting raw crawler logs.

**Suggested commit:** `feat(web): publish traceable portal evidence pages`

---

### Session 15 — Experience submission and portal experience UI

**Goal:** Add the public experience flow after the portal pages and design system exist.

**Implement:**

- Build the staged, portal-anchored share-an-experience form from section 10.5.
- Provide structured task, outcome, theme, device, and optional rating choices.
- Add bounded optional free text with prominent do-not-share-personal-information guidance.
- Add explicit consent, moderation, independent-project, non-grievance, and no-government-response language.
- Add accessible field validation, error summary, review step, double-submit prevention, success state, rate-limit state, and database-unavailable state.
- Preserve non-sensitive form state for same-session retry only; clear it after success.
- Build the separate approved-experience summary and list from section 10.6.
- Show approved count, covered dates, outcomes, themes, cautious rating treatment, pagination, moderation/sampling disclaimer, and empty state.
- Add privacy, moderation, removal-contact, and official-grievance guidance links.
- Ensure experience styling is visually distinct from audit evidence.

**Do not:** Add sign-in, identity fields, attachments, arbitrary portal URLs, public posting before moderation, comments, replies, or a web admin panel.

**Tests:** Keyboard and screen-reader flow, validation, consent, privacy copy, double submission, rate limit, API/database error, safe rendering, pagination, empty/small sample, responsive behavior, and proof that experiences never alter technical audit status.

**Exit criteria:** A visitor can submit anonymously from a portal page; the pending submission is not public; CLI approval makes its redacted version appear under the correct portal in a clearly separate citizen-experience section.

**Suggested commit:** `feat(web): add moderated citizen experience flow`

---

### Session 16 — Methodology, exports, and trust surfaces

**Goal:** Make the product's boundaries and reproducibility as visible as its findings.

**Implement:**

- Methodology page based on versioned content.
- Inventory-source list and retrieval dates.
- Check, severity, confidence, and review explanations.
- Limitations and ethical disclaimer.
- JSON/CSV download links with file size/date where feasible.
- Changelog/corrections section.
- Human-readable audit report generation if included.

**Tests:** Download integrity, metadata consistency, methodology version matches dataset, dead internal-link scan.

**Exit criteria:** A skeptical evaluator can determine what the scorecard does and does not establish.

**Suggested commit:** `feat(web): add methodology and open audit exports`

---

### Session 17 — Assam source research and controlled pilot crawl

**Goal:** Replace fixtures with a carefully bounded real Assam inventory and first raw run.

**Precondition:** The §12.5 legal-risk and live-crawl approval gate is recorded (ADR, target-host register, and sign-off) before any request targets a live government host; the smoke crawl requires separate approval before the estate-wide run.

**Implement/work:**

- Verify official inventory sources and archive source evidence.
- Curate portal candidates and official status.
- Resolve ambiguous duplicates manually.
- Run 3–5 portal smoke audit first.
- Inspect logs, rate behavior, parsing failures, and artifacts.
- Adjust per-portal configuration without weakening global safety.
- Run the bounded observed estate.
- Preserve raw run manifest and limitations.

**Do not:** Publish automatically or alter rules to force interesting results.

**Tests:** Schema validation, run completeness, spot-check sampled observations against browser/manual inspection.

**Exit criteria:** A dated raw Assam audit exists; failures in the audit system are separated from failures of target websites.

**Suggested commit:** `data: add sourced Assam inventory and pilot observations`

**Status as of 2026-09-04 — complete.**

- §12.5 gate recorded for both the smoke crawl (`docs/architecture-decisions/0001-live-crawl-legal-risk-acceptance.md`) and the estate-wide run (`docs/architecture-decisions/0002-estate-wide-crawl-authorization.md`), with `docs/target-host-register.md` as the host-by-host record.
- Real 177-portal inventory built via the `assam-igod-directory` source (igod.gov.in), with a clean 5-portal smoke crawl run and inspected first.
- The ~91 unreachable/geoblocked portals question (§12.5 precondition) was resolved by attempting every portal for real rather than pre-excluding any — see ADR 0002 for why an earlier `disabledDomains` pre-exclusion plan was reverted (it would have silently produced `technicalHealth: "healthy"` for portals never actually checked).
- Two real, independently-verified bugs in the crawler's own error classification (an SSRF-DNS-check mislabeling and an unrecognized undici timeout code) were found and fixed after a first estate-wide run produced implausible numbers (21/177 succeeded); both bugs made genuine target-website failures look like audit-system failures or vice versa, directly undermining this session's own exit criterion. Fixed, regression-tested, and confirmed against known-good hosts before re-running.
- The corrected estate-wide crawl (`assam-2026-09-04-r1`, `--max-pages 10` bound) is the final dated raw run: 177 portals attempted, 76 succeeded / 9 partial / 92 failed, with an honest failure-cause distribution (mostly genuine `CONNECT_TIMEOUT`, no audit-system-bug contamination) — verified by confirming the 5 originally smoke-tested hosts all still succeeded. `analyze` has been run against it (2,180 candidate findings, `data/raw/analysis/assam-2026-09-04-r1`). Exit criteria met: a dated raw Assam audit exists, and audit-system failures are separated from target-website failures.

**Handoff to Session 18/21:** the real, completed dataset now exists. Session 18 (evidence review) and Session 21 (case-study narrative) can proceed for real, no longer against fixtures.

---

### Session 18 — Evidence review and case-study dataset

**Goal:** Produce the defensible reviewed dataset shown in the final product.

**Implement/work:**

- Review every candidate critical and significant finding.
- Repeat availability failures on separate occasions where required.
- Check screenshots/artifacts for privacy and relevance.
- Record `privacyReviewed: true`, reviewer, and review time for every artifact referenced by a finding proposed for publication; unreviewed artifacts cannot be published.
- Rewrite summaries only within editorial rules.
- Create 1–2 structured overlap comparisons only if evidence supports them.
- Document `not_assessable` portals.
- Select three detailed hero portal stories.
- Publish the validated dataset and exports.

**Tests:** Publication validation; manual URL/evidence spot checks; counts reconcile; no unsupported categorical language.

**Exit criteria:** Every public claim is traceable to privacy-reviewed evidence, every published artifact has `privacyReviewed: true`, and every interpretive claim has a recorded review decision.

**Suggested commit:** `data: publish reviewed Assam audit snapshot`

---

### Session 19 — End-to-end quality and accessibility

**Goal:** Verify the complete product under realistic use and failure conditions.

**Implement/work:**

- Complete Playwright task flows.
- Run automated accessibility audit and manual keyboard review.
- Test mobile, tablet, desktop, 200% zoom, reduced motion, and long content.
- Test the hybrid deployment build from a clean checkout and verify audit pages remain statically generated.
- Run internal-link and export checks.
- Check performance and reduce oversized client bundles/artifacts.
- Verify raw HTML cannot enter rendered pages.
- Check all disclaimers, dates, versions, and source labels.
- Create a formal release checklist.

**Exit criteria:** All quality gates pass; no critical accessibility issue; no broken core journey; release checklist is signed off in the session log.

**Suggested commit:** `test: harden scorecard end-to-end quality`

---

### Session 20 — Usability test and refinement

**Goal:** Validate that people understand the evidence model and can complete the core task.

**Implement/work:**

- Prepare a neutral test script using the tasks in section 13.3.
- Test with 3–5 relevant participants or informed proxies.
- Record observations without leading participants.
- Rank issues by task impact and frequency.
- Fix the highest-impact comprehension/navigation problems.
- Re-run affected tests.
- Document validated findings and remaining assumptions.

**Exit criteria:** Participants can distinguish observed failure from inferred review, identify priorities, find provenance, and understand suggested actions.

**Suggested commit:** `fix(ux): refine scorecard from usability evidence`

---

### Session 21 — Case-study narrative and demo mode

**Goal:** Package the working product into a convincing case-study story without weakening factual discipline.

**Implement/work:**

- Write case-study narrative: context → blind spot → bounded approach → product → evidence → learning → limitations → next hypothesis.
- Create the hero demonstration path:
  `official source → listed portal → observed failure → citizen impact → finding → suggested action`.
- Add a stable demo dataset/run if live sites change, clearly labeled with its audit date.
- Produce diagrams/screenshots needed for presentation.
- Cite all external factual claims.
- Keep NSW precedent brief and distinguish GOV.UK-scale work.
- Prepare a 5-minute and extended demo script.

**Exit criteria:** Every slide/section claim is either cited external research, product evidence, or explicitly labeled inference; the demo works without relying on live target sites.

**Suggested commit:** `docs: complete Panchnama case study and demo narrative`

---

### Session 22 — Deployment and reproducibility handoff

**Goal:** Publish the static scorecard and ensure another developer/AI can reproduce it.

**Implement/work:**

- Configure application hosting while preserving static generation for audit pages.
- Select hosting that supports the small Next.js server API and PostgreSQL connection as well as statically generated audit pages.
- Provision the production database, apply migrations through a controlled release step, and configure secrets without committing them.
- Verify backup, retention, connection limits/pooling, and database-unavailable behavior.
- Add build-time validation before deployment.
- Set cache and security headers where hosting permits.
- Verify custom domain only if available and appropriate.
- Document exact inventory, audit, review, publish, and deploy commands.
- Test from a clean clone/environment.
- Tag the audit release and retain its manifest.
- Create a public correction/contact route.

**Exit criteria:** Deployment is accessible, dated, and clearly unofficial; clean-clone reproduction succeeds; rollback artifact exists.

**Suggested commit:** `chore: release Assam audit case-study prototype`

---

## 15. Standard prompt for each AI coding session

Use this template with Codex, Claude, or another coding agent:

```text
You are implementing Panchnama in the repository provided.

Read implementation.md completely, then inspect the repository and any AGENTS.md files.
Implement only Session <NUMBER>: <SESSION NAME>.

Rules:
- Preserve completed work and existing user changes.
- Do not implement later sessions.
- Follow the locked product decisions, schemas, safety boundaries, and exit criteria.
- If implementation.md conflicts with actual repository constraints, document the conflict and choose the smallest safe adjustment.
- Use shared schemas; do not create duplicate domain types.
- Add or update tests for every behavior changed.
- Run the session verification plus repository-wide relevant quality checks.
- Do not make CI rely on live government sites.
- Do not publish unreviewed adverse findings.
- Update docs/session-log.md with files changed, decisions, tests run, results, known limitations, and the next session's prerequisites.

At completion, report:
1. Outcome.
2. Files changed.
3. Tests and results.
4. Deviations from implementation.md.
5. Risks or unresolved items.
6. Whether every exit criterion passed.
```

---

## 16. Definition of done

The case-study prototype is complete only when:

- the observed Assam web estate has documented, dated source provenance;
- the crawler can reproduce a bounded audit without unsafe or unbounded behavior;
- raw observations conform to versioned schemas;
- candidate findings are generated by versioned deterministic rules;
- interpretive findings have explicit human review records;
- published findings have resolvable evidence and plain-language limitations;
- the public interface separates technical health, continuing role, and suggested action;
- no composite score or unsupported retirement decision appears;
- `Not assessable` is handled honestly throughout;
- users can find priorities, evidence, provenance, and actions;
- JSON and CSV exports match the displayed audit;
- PostgreSQL migrations apply cleanly from an empty database and are documented;
- anonymous experience submissions accept only known portal IDs and collect no authentication or identity fields;
- all submissions remain private until moderated, and public reads expose only approved/redacted content;
- citizen experiences appear separately and cannot alter technical audit classifications;
- submission abuse, privacy, retention, database-outage, and removal paths are implemented and tested;
- methodology, audit date, scope, and unofficial status are prominent;
- fixture-based unit, integration, UI, end-to-end, and accessibility tests pass;
- the hybrid product builds and deploys from a clean checkout, with statically generated audit pages and a functioning submission API;
- the case-study narrative uses verified claims and demonstrates one end-to-end hero example;
- limitations and future hypotheses are explicit.

---

## 17. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Official inventory is incomplete | “All websites” claim becomes indefensible | Use observed-estate definition and preserve source provenance |
| Transient outages create false findings | Reputational and analytical harm | Repeat checks, timestamp evidence, use `not_assessable`, human review |
| Bot protection appears as downtime | False critical result | Detect blocks/auth/CAPTCHA and classify separately |
| Dynamic sites evade HTTP parsing | Under-counted links/content | Allowlisted Playwright fallback and coverage disclosure |
| Crawl scope explodes | Slow or unsafe prototype | Hard caps, depth limits, exclusions, per-host rate limits |
| Staleness heuristics overreach | Unfair policy claims | Publish signals only; require review |
| Overlap is mistaken for redundancy | Invalid recommendation | Structured comparison and `possible_overlap` wording |
| Evidence changes after audit | Demo becomes inconsistent | Dated snapshots, stored artifacts, stable demo release |
| Screens imply official endorsement | Trust/legal confusion | Independent brand and persistent disclaimer |
| Dashboard overwhelms users | Core task fails | Overview → inventory → evidence progressive disclosure |
| Live web makes CI flaky | Unreliable development | Deterministic fixture sites; live checks opt-in |
| Data contains malicious HTML or CSV formulas | Security risk | Never render raw HTML; escape content; sanitize exports |
| National vision expands v1 | Project fails brief | Finish Assam and present scale as a future hypothesis |
| Anonymous form attracts spam or abuse | Moderation burden and harmful content | Rate limits, honeypot, duplicate signals, pending-by-default moderation |
| Users submit identity/application/payment data | Privacy harm | Do not request it, warn clearly, flag patterns, redact/reject before publication |
| Experiences are mistaken for verified or representative evidence | Misleading conclusions | Separate section, display sample counts/dates, moderation and sampling disclaimer |
| Database outage blocks the scorecard | Loss of core product | Keep audit pages statically generated; degrade only the submission/experience feature |
| No authentication makes web moderation unsafe | Unauthorized publication decisions | No moderation API/UI; use controlled offline CLI for v1 |

---

## 18. Future work—not authorized for version one

After the Assam case study is complete and evaluated, possible next experiments include:

- repeating the method for a second state to test transferability;
- comparing inventory-source structures across states;
- adding change-over-time views from multiple dated snapshots;
- building authenticated web moderation or a private review interface for audit teams;
- adding ownership and remediation-status workflows;
- measuring accessibility with a carefully bounded, non-certifying ruleset;
- creating an API for published audit data;
- adding scheduled runs and alerts;
- studying citizen task completion on a small set of high-impact services;
- establishing a government correction and response process.

None of these should be started until the version-one definition of done is satisfied.

### 18.1 Deferred operational gaps (fix after all sessions, before real production use)

- **Real User-Agent contact route.** `config/crawl-policy.yaml`'s
  `robotsAndIdentification.userAgent`/`contactUrl` are still placeholder
  `panchnama.example.org` values, not a real, monitored contact route a
  department could use to reach the crawl operator — which §6.3 calls
  for once actually deployed against live hosts. Session 17's live-crawl
  ADR (§12.5) explicitly accepts this gap for the bounded, low-volume
  3–5 portal smoke crawl only. It must be replaced with a real address
  before any wider or repeated live crawling beyond that pilot.
