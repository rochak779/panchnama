import { z } from "zod";

/**
 * ID convention
 * ---------------------------------------------------------------------------
 * implementation.md section 5 (preamble): "All IDs must be stable, URL-safe
 * strings. Never use array indexes as identifiers."
 *
 * `stableId` enforces the "URL-safe string" half of that rule structurally: a
 * non-empty string built only from the unreserved URL character set (RFC
 * 3986 §2.3: ALPHA / DIGIT / "-" / "." / "_" / "~"). Every `id`, `portalId`,
 * `runId`, `findingId`, `overlapComparisonId`, source ref, and similar
 * identifier field in this package reuses this schema instead of a bare
 * `z.string()`.
 *
 * The "never use array indexes as identifiers" half is a process rule for
 * the *callers* that generate IDs (crawler, CLI, ingestion code in later
 * sessions) — Zod can validate the shape of a string but cannot know whether
 * a caller derived it from `array[i]`. Enforce that rule in code review and
 * in the ID-generation helpers written in later sessions, not here.
 */
export const stableId = z
  .string()
  .min(1, "id must not be empty")
  .regex(
    /^[A-Za-z0-9._~-]+$/,
    "id must be a URL-safe string (unreserved URL characters only: A-Z a-z 0-9 - . _ ~)",
  );

export type StableId = z.infer<typeof stableId>;

/**
 * `schemaVersion` convention
 * ---------------------------------------------------------------------------
 * Every top-level stored/published record type carries a required
 * `schemaVersion` string field, per the cross-cutting rule stated in the
 * preamble to implementation.md section 5 ("Every schema must include
 * `schemaVersion`"). This applies even where a given interface in section 5
 * doesn't literally list the field (only `AuditRun` shows it explicitly).
 *
 * Nested value objects that only ever exist embedded inside a parent record
 * (e.g. `Portal.discovery[]` entries, `PageObservation.redirectChain[]`
 * entries, `PublishedPortalAssessment.crawlCoverage`) do NOT get their own
 * `schemaVersion` — they version implicitly with their parent record.
 *
 * Migration placeholder convention (no working migration system exists yet
 * in Session 1 — this is a documented convention for later sessions):
 *   1. Bump the affected entity's `*_SCHEMA_VERSION` constant below.
 *   2. Keep the previous schema available under a versioned name (e.g.
 *      rename the current `portalSchema` export to `portalSchemaV1` and add
 *      a new `portalSchemaV2`).
 *   3. Write an explicit `migratePortalV1ToV2(old): PortalV2` function that
 *      maps the old shape to the new one field-by-field.
 *   4. Never silently coerce, guess, or default a migrated value inside a
 *      live schema's `.parse()` path — a migration must be an explicit,
 *      reviewed function, and unreadable old records should fail loudly.
 * This session only establishes the version constants and this convention;
 * every entity is at version "1.0.0" and no migration functions exist yet
 * because there is only one version of every entity so far.
 */
export const SCHEMA_VERSIONS = {
  inventorySource: "1.0.0",
  portal: "1.0.0",
  auditRun: "1.0.0",
  pageObservation: "1.0.0",
  linkObservation: "1.0.0",
  finding: "1.0.0",
  evidenceArtifact: "1.0.0",
  portalOverlapComparison: "1.0.0",
  publishedPortalAssessment: "1.0.0",
  reviewDecision: "1.0.0",
  experienceSubmission: "1.0.0",
  portalExperienceSummary: "1.0.0",
} as const;

/**
 * Reusable required `schemaVersion` field. Kept as a plain non-empty string
 * (not a `z.literal` pinned to the current constant) so that a record
 * written under an older-but-still-parseable version doesn't fail parsing
 * purely on this field; callers that care about the exact version compare
 * the parsed value against `SCHEMA_VERSIONS.<entity>` themselves.
 */
export const schemaVersionField = z.string().min(1, "schemaVersion must not be empty");

/**
 * ISO 8601 UTC timestamp string, per section 4.1 ("Dates: ISO 8601 UTC in
 * stored data"). Validated as a string Zod recognizes as a datetime; does
 * not force a specific millisecond/offset format beyond ISO 8601 validity.
 */
export const isoTimestamp = z
  .string()
  .datetime({ offset: true, message: "must be an ISO 8601 UTC timestamp" });

/**
 * Non-empty, trimmed free-text field helper for required plain-language
 * strings (titles, summaries, rationale, etc.) so empty strings don't slip
 * through as "valid but meaningless" data.
 */
export const nonEmptyString = z.string().trim().min(1);

/**
 * HTTP(S)-or-general URL string. Section 6.5/12.1 restrict *fetched* schemes
 * to HTTP/HTTPS at crawl time; at the schema layer we validate general URL
 * well-formedness with `z.string().url()` rather than re-encoding the crawl
 * policy's scheme allowlist here (that belongs to the crawler/config layer
 * in later sessions, which can layer stricter checks on top of this).
 */
export const urlString = z.string().url();

/**
 * Unknown-field policy
 * ---------------------------------------------------------------------------
 * All object schemas in this package use `.strict()`, at every nesting
 * level, rather than Zod's default "strip unknown keys silently" behavior.
 * This is a domain where silent data drift is a real risk: audit records,
 * evidence artifacts, and review decisions are meant to be an inspectable,
 * reproducible paper trail (section 1.6, principle 7), and a field that was
 * silently stripped during `.parse()` would be invisible in that trail. A
 * schema mismatch (extra/renamed/typo'd field from a producer) should be a
 * loud validation failure, not a silent drop. Every schema file in this
 * package should follow this same convention for consistency.
 */
