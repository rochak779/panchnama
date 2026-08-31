/**
 * @panchnama/schema
 *
 * Placeholder entry point. Session 1 ("Domain schemas and fixtures") will
 * populate this package with the Zod schemas and TypeScript types defined in
 * implementation.md section 5 (enumerations, InventorySource, Portal,
 * AuditRun, PageObservation, LinkObservation, Finding, EvidenceArtifact,
 * PortalOverlapComparison, PublishedPortalAssessment, ReviewDecision,
 * ExperienceSubmission, PortalExperienceSummary).
 *
 * Do not add domain types to any other package — this is the single source
 * of truth for shared data contracts across the monorepo.
 */

/** Package identifier, used by other packages/tests to confirm resolution. */
export const PACKAGE_NAME = "@panchnama/schema" as const;
