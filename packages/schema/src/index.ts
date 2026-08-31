/**
 * @panchnama/schema
 *
 * Shared Zod schemas and inferred TypeScript types for every domain record
 * defined in implementation.md section 5. This is the single source of
 * truth for these types across the monorepo — no other package should
 * redefine them; import from here instead.
 *
 * File layout (one file per major entity, re-exported from this index):
 *   - common.ts               shared primitives: stableId, schemaVersion
 *                              field, ISO timestamps, URL strings, the
 *                              schema-version constants/migration
 *                              convention, and the unknown-field policy.
 *   - enums.ts                every enumeration from §5.1, §5.8, §5.12.
 *   - inventory-source.ts     §5.2 InventorySource
 *   - portal.ts                §5.3 Portal
 *   - audit-run.ts             §5.4 AuditRun
 *   - observation.ts           §5.5 PageObservation, §5.6 LinkObservation
 *   - finding.ts                §5.7 Finding
 *   - evidence.ts               §5.8 EvidenceArtifact
 *   - overlap.ts                §5.9 PortalOverlapComparison
 *   - published-assessment.ts   §5.10 PublishedPortalAssessment
 *   - review.ts                 §5.11 ReviewDecision
 *   - experience.ts             §5.12 ExperienceSubmission,
 *                                §5.13 PortalExperienceSummary
 */

/** Package identifier, used by other packages/tests to confirm resolution. */
export const PACKAGE_NAME = "@panchnama/schema" as const;

export * from "./common.js";
export * from "./enums.js";
export * from "./inventory-source.js";
export * from "./portal.js";
export * from "./audit-run.js";
export * from "./observation.js";
export * from "./finding.js";
export * from "./evidence.js";
export * from "./overlap.js";
export * from "./published-assessment.js";
export * from "./review.js";
export * from "./experience.js";
