# @panchnama/schema

Shared Zod schemas and TypeScript types for the Panchnama domain model
(implementation.md section 5): enumerations, `InventorySource`, `Portal`,
`AuditRun`, `PageObservation`, `LinkObservation`, `Finding`,
`EvidenceArtifact`, `PortalOverlapComparison`, `PublishedPortalAssessment`,
`ReviewDecision`, `ExperienceSubmission`, and `PortalExperienceSummary`.

**Status:** implemented in Session 1 ("Domain schemas and fixtures"). Every
other package must import domain types from here rather than redefining
them.

- Schemas are `.strict()` Zod object schemas; see `src/common.ts` for the
  shared `stableId`, `schemaVersion`, timestamp, and URL primitives, and the
  unknown-field-policy rationale.
- Valid, mutually-consistent example fixtures for every entity live in
  `src/fixtures/valid.ts`.
- See `docs/data-dictionary.md` at the repo root for a human-readable
  mirror of every enum and entity.
- Deferred cross-record §5.14 invariants are marked `// TODO(session-N: ...)`
  next to the relevant schema.
