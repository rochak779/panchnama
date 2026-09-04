import { getPublishedAuditRun } from "./publishedRun";

/**
 * Session 16, Task 1 — the single canonical source for the methodology
 * version string and every prose/data topic implementation.md section 10.7
 * requires the `/methodology` page (Task 2) to cover. No React here: this
 * module is plain data so it can be imported both by a Server Component
 * page and by `apps/web/scripts/build-exports.ts` (a `tsx`-run Node
 * script, not part of the Next.js app) without pulling in any React/JSX
 * dependency.
 *
 * `CURRENT_METHODOLOGY_VERSION` must always equal the real published
 * `data/published/current` → `audit-run.json`'s `methodologyVersion`
 * field — that published run is the "single source of truth" this
 * session's global constraints name, and `methodologyContent.test.ts`
 * asserts the equality by reading that file directly, not by comparing
 * against another constant that could drift alongside this one.
 *
 * `CHECK_DEFINITIONS` and `KNOWN_LIMITATIONS` are derived at
 * module-load/build time from the same published run (via
 * `publishedRun.ts`'s already-validated `getPublishedAuditRun`) rather
 * than hand-written here, so they can never silently disagree with what
 * the rest of the app renders from that run.
 */

export const CURRENT_METHODOLOGY_VERSION = "0.1.0";

export interface MethodologyVersionEntry {
  version: string;
  date: string; // ISO date
  summary: string; // one-line changelog/correction note
}

export const METHODOLOGY_VERSION_HISTORY: MethodologyVersionEntry[] = [
  {
    version: "0.1.0",
    date: "2026-09-04",
    summary: "Initial published methodology — real Assam estate audit (assam-2026-09-04-r1).",
  },
];

/**
 * `entries` sorted most-recent-first by `date`. Defaults to the real
 * `METHODOLOGY_VERSION_HISTORY`, which both `/methodology` and `/exports`
 * render as the same version history table and previously re-derived this
 * sort independently — this is the single shared implementation both pages
 * now use instead. The optional parameter exists so tests can exercise the
 * sort against a synthetic multi-entry array without adding a fake entry to
 * the real (currently single-entry) constant.
 */
export function sortedVersionHistory(
  entries: MethodologyVersionEntry[] = METHODOLOGY_VERSION_HISTORY,
): MethodologyVersionEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * implementation.md section 2.3, "Definition of the observed Assam web
 * estate", and section 2.4, "Unit of analysis" — the actual inclusion rule
 * this pilot uses, not an invented one.
 */
export const OBSERVED_ESTATE_RULES: string =
  "The observed Assam web estate is all citizen-facing websites or portals discoverable from the " +
  "selected official Assam government directories and their outbound links, as observed on the audit " +
  "date. A portal is admitted as verified official when at least one trusted government source links " +
  "to or lists it as official; search-engine discovery alone is never sufficient. Additional candidates " +
  "can be recorded as unverified until manually confirmed. This is not a claim that the inventory " +
  "includes every Assam government website. One top-level scorecard record represents one " +
  "independently operated website or service portal; a portal can span multiple hostnames when that " +
  "relationship is documented, and individual pages, links, findings, and sampled citizen journeys are " +
  "nested evidence, not separate top-level records.";

/**
 * implementation.md section 2.1 (ingestion) and section 5.3's `Portal.sourceRefs`
 * / `discovery` fields — how each portal's admission is sourced and recorded.
 */
export const INVENTORY_SOURCES_NOTE: string =
  "The inventory is seeded by ingesting one or more documented official Assam government directories. " +
  "Every website's source and discovery route is preserved: each portal record keeps a reference to the " +
  "directory or directories that listed it, plus a discovery entry recording when it was found, the URL " +
  "it was discovered from, and whether it was listed directly, reached via an outbound link, or added " +
  "manually. This lets any inventory entry be traced back to the government source that justified its " +
  "inclusion.";

/**
 * implementation.md section 6 (crawl policy), described generally — the
 * same boundaries apply to any crawl this pipeline runs, not only a live
 * one.
 */
export const CRAWL_BOUNDARIES_NOTE: string =
  "The crawler stays within a bounded, same-origin scope per portal: a fixed maximum number of HTML " +
  "pages, a shallow maximum depth from the configured start URL, and it does not follow discovered " +
  "subdomains unless they are already part of the portal's documented hostnames. It respects robots.txt " +
  "and records the robots decision for every page; if deeper crawling is disallowed, the limited " +
  "coverage is published rather than circumvented. It excludes login, logout, authentication, and " +
  "payment routes, and never submits forms or attempts to bypass a technical access control. It " +
  "identifies itself with a descriptive user agent, uses modest request rates and delays between " +
  "requests to the same host, and never stores cookies, tokens, or form contents. Browser rendering is " +
  "used only as an allowlisted fallback for pages whose core content is not visible in the plain HTTP " +
  "response, and every use of it is recorded.";

export interface CheckDefinition {
  id: string;
  label: string;
  description: string;
}

/**
 * Plain-English descriptions for every rule id the real published audit
 * run's `data/published/current` → `audit-run.json` `enabledChecks` array
 * can name, keyed by id (Session 17's real Assam crawl; see
 * `packages/audit-core/src/rules/*.ts` for each rule's own source of
 * truth). `CHECK_DEFINITIONS` below filters this map down to exactly the
 * ids the published run actually enables, so adding an unused entry here
 * can never silently inflate the exported list, and an enabled id missing
 * from this map fails loudly instead of rendering a blank description.
 */
const CHECK_CATALOG: Record<string, Omit<CheckDefinition, "id">> = {
  "availability.unavailable.v1": {
    label: "Availability — unavailable",
    description:
      "Flags a portal whose entry URL fails across three spaced automated attempts. Recorded as a " +
      "critical finding with high confidence; a single failed request is never enough on its own.",
  },
  "availability.server-error.v1": {
    label: "Availability — server error",
    description:
      "Flags a portal whose entry URL repeatedly returns a 5xx (server error) response rather than " +
      "failing to connect at all — the server responded, but with an error.",
  },
  "availability.not-found.v1": {
    label: "Availability — not found",
    description:
      "Flags a portal whose official entry URL repeatedly returns 404 (not found) or 410 (gone).",
  },
  "redirect.cross-domain.v1": {
    label: "Redirect — cross-domain",
    description:
      "Flags a portal whose entry URL resolves, after following redirects, to a final host outside the " +
      "portal's registered hostnames. Recorded as advisory pending manual review, since a cross-domain " +
      "redirect is not automatically a problem.",
  },
  "availability.automation-blocked.v1": {
    label: "Availability — automation blocked",
    description:
      "Flags a bot-check or CAPTCHA detected on the entry page. This is not treated as a confirmed " +
      "availability failure — automation being blocked is not evidence the portal itself is broken.",
  },
  "availability.access-restricted.v1": {
    label: "Availability — access restricted",
    description:
      "Flags an access-restriction response (for example, a login wall) on the entry URL. Recorded " +
      "distinctly from a confirmed availability failure, since the portal may simply require credentials " +
      "this audit does not use.",
  },
  "broken_link.repeated-failure.v1": {
    label: "Broken link — repeated failure",
    description:
      "Flags a link destination, reached from one or more of a portal's own pages, that repeatedly " +
      "fails when checked. Each finding names the failing destination and every source page on the " +
      "portal that links to it.",
  },
  "https.certificate-failure.v1": {
    label: "HTTPS — certificate failure",
    description: "Flags a certificate expiry or hostname mismatch observed while accessing the entry page.",
  },
  "https.no-tls-upgrade.v1": {
    label: "HTTPS — no TLS upgrade",
    description: "Flags a portal whose entry URL's final destination, after redirects, does not use HTTPS.",
  },
  "freshness.no-signal.v1": {
    label: "Freshness — no signal",
    description:
      "Records, honestly, that no content-level freshness signal (a last-updated date, a dated notice) " +
      "could be extracted this run — this audit's crawler does not yet read raw page text. Advisory, " +
      "low confidence: it is not evidence the content is stale, only that this run could not check.",
  },
  "crawl_coverage.summary.v1": {
    label: "Crawl coverage summary",
    description:
      "Records what this run did and did not cover for a portal: pages observed against the configured " +
      "maximum, and how many discovered URLs were not fetched. Not a judgment — a coverage disclosure " +
      "every other finding for the portal should be read against.",
  },
  "directory_mismatch.unavailable-destination.v1": {
    label: "Directory mismatch — unavailable destination",
    description:
      "Flags an official directory entry that points to a destination this run independently found " +
      "critically unavailable.",
  },
  "directory_mismatch.listed-vs-observed.v1": {
    label: "Directory mismatch — listed vs. observed",
    description:
      "Flags a disagreement between an official directory's listed name or URL and what was actually " +
      "observed at the portal's canonical URL — a heuristic comparison requiring manual confirmation, " +
      "not a semantic or authoritative match.",
  },
  "directory_mismatch.official-portal-not-listed.v1": {
    label: "Directory mismatch — official portal not listed",
    description:
      "Flags a verified official portal that is not backed by any official-directory-typed source in " +
      "this inventory build.",
  },
};

function buildCheckDefinitions(): CheckDefinition[] {
  const auditRun = getPublishedAuditRun();
  return auditRun.enabledChecks.map((id) => {
    const entry = CHECK_CATALOG[id];
    if (!entry) {
      throw new Error(
        `methodologyContent.ts has no plain-English description for enabled check "${id}" — ` +
          "add one to CHECK_CATALOG so the methodology page and exports never show a blank description.",
      );
    }
    return { id, ...entry };
  });
}

/** One entry per real check id enabled in `data/fixtures/audit-run.json`. */
export const CHECK_DEFINITIONS: CheckDefinition[] = buildCheckDefinitions();

/**
 * implementation.md section 8.1 and 8.2 (`severitySchema` / `confidenceSchema`
 * in `packages/schema/src/enums.ts`) — the real three-tier definitions, not
 * invented ones.
 */
export const SEVERITY_CONFIDENCE_RULES: string =
  "Every finding carries a severity and a confidence, judged separately. Severity: critical means a " +
  "portal or essential citizen route is unavailable, an official link leads to a dead essential " +
  "service, or a comparable failure blocks the primary task; significant means substantial navigation " +
  "failure, an HTTPS/certificate access failure, or verified outdated service information is likely to " +
  "materially impede users; advisory means a directory inconsistency, weak freshness evidence, partial " +
  "coverage, an unusual redirect, or a possible overlap needs attention but does not prove immediate " +
  "user blockage. Confidence: high means repeated direct observation with unambiguous evidence; medium " +
  "means multiple signals support the finding but context could change the interpretation; low means " +
  "the evidence is heuristic or incomplete and must not be read as categorical.";

/**
 * implementation.md section 8.3 (publication gate) and `reviewStatusSchema`.
 */
export const HUMAN_REVIEW_PROCESS: string =
  "No finding is published on the strength of an automated observation alone. Every finding carries a " +
  "review status: automated_observation and pending_review are working states awaiting a human " +
  "decision; reviewed means a human confirmed the finding is accurate and fit to publish; rejected " +
  "means a human reviewed the automated signal and determined it did not hold up, most often because " +
  "the underlying condition had a benign explanation; not_assessable is an honest terminal state for a " +
  "condition (such as a CAPTCHA block) that automation and review agree cannot be fairly assessed. Only " +
  "reviewed and not_assessable findings are ever shown publicly or included in an export; " +
  "pending_review, automated_observation, and rejected findings never reach a published page.";

/**
 * implementation.md section 8.3 item 3 and `apps/web/src/lib/portalDetail.ts`'s
 * `publishedEvidenceForFinding` gate.
 */
export const EVIDENCE_RETENTION_NOTE: string =
  "Evidence supporting a finding — page snapshots, screenshots, redirect chains, and similar artifacts " +
  "— is retained so a finding can be reproduced or challenged. Before any such artifact can be linked " +
  "from a published finding, it must be reviewed for personal or confidential content and marked " +
  "privacy-reviewed; automatic pattern detection alone never satisfies this requirement. No finding is " +
  "published unless every evidence artifact it cites has passed this privacy review.";

/**
 * Pulled directly from `data/fixtures/audit-run.json`'s `limitations`
 * array — never hand-written here, so it cannot drift from the actual
 * run's recorded limitations.
 */
export const KNOWN_LIMITATIONS: string[] = getPublishedAuditRun().limitations;

/**
 * implementation.md section 12.3's disclaimer plus section 2.2's
 * out-of-scope list (no automated decisions, not a grievance channel).
 */
export const ETHICAL_DISCLAIMER: string =
  "Panchnama is an independent project and is not affiliated with or endorsed by the " +
  "Government of Assam. It is not an official government service and not a citizen grievance or " +
  "complaint channel — it does not track, forward, or resolve individual cases. Findings describe " +
  "observations made at the stated times and within the published audit coverage; they are not legal, " +
  "security, accessibility, or policy determinations. No automated decision made by this project takes " +
  "any action affecting any citizen, department, or portal.";

/**
 * implementation.md section 9.6-9.8 and 10.7's "experience-submission,
 * privacy, moderation, aggregation, retention, and non-representative-sample
 * policies" line — kept short here per the task brief, with the full
 * policy living on `/privacy` (Task 2) rather than being duplicated.
 */
export const EXPERIENCE_POLICY_SUMMARY: string =
  "Citizens may anonymously submit a structured account of their experience using a portal already in " +
  "the inventory. Submissions are held for moderation and only approved, privacy-reviewed experiences " +
  "are published, in a separate section from the technical audit — they never automatically alter a " +
  "portal's technical health, severity, or suggested action. Published experiences are aggregated by " +
  "theme and outcome and are not a statistically representative sample of all users. See the full " +
  "privacy and moderation policy for retention periods and what is and is not collected.";
