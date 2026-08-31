import { z } from "zod";

/**
 * Enumerations from implementation.md section 5.1, plus the entity-scoped
 * enums declared alongside their entities in 5.8 and 5.12. Each is a Zod
 * enum (so it is usable both as a runtime validator and, via `z.infer`, as
 * an exported TypeScript union type) matching the literal string values in
 * the spec exactly.
 */

export const officialStatusSchema = z.enum(["verified", "unverified", "disputed"]);
export type OfficialStatus = z.infer<typeof officialStatusSchema>;

export const technicalHealthSchema = z.enum([
  "healthy",
  "degraded",
  "unavailable",
  "not_assessable",
]);
export type TechnicalHealth = z.infer<typeof technicalHealthSchema>;

export const continuingRoleSchema = z.enum([
  "distinct",
  "possible_overlap",
  "unclear",
  "not_reviewed",
]);
export type ContinuingRole = z.infer<typeof continuingRoleSchema>;

export const suggestedActionSchema = z.enum([
  "maintain",
  "repair",
  "review_consolidation",
  "review_retirement",
  "manual_assessment",
]);
export type SuggestedAction = z.infer<typeof suggestedActionSchema>;

export const severitySchema = z.enum(["critical", "significant", "advisory"]);
export type Severity = z.infer<typeof severitySchema>;

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const reviewStatusSchema = z.enum([
  "automated_observation",
  "pending_review",
  "reviewed",
  "rejected",
  "not_assessable",
]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const checkStatusSchema = z.enum([
  "pass",
  "fail",
  "warning",
  "not_applicable",
  "not_assessable",
]);
export type CheckStatus = z.infer<typeof checkStatusSchema>;

/** Section 5.8. */
export const evidenceTypeSchema = z.enum([
  "http_response_snapshot",
  "screenshot",
  "text_excerpt",
  "redirect_chain",
  "certificate_detail",
  "directory_listing",
  "link_check_result",
  "manual_note",
]);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

/** Section 5.12. */
export const experienceStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "needs_redaction",
]);
export type ExperienceStatus = z.infer<typeof experienceStatusSchema>;

export const taskOutcomeSchema = z.enum([
  "completed",
  "partially_completed",
  "not_completed",
  "information_only",
]);
export type TaskOutcome = z.infer<typeof taskOutcomeSchema>;

export const experienceThemeSchema = z.enum([
  "availability",
  "navigation",
  "content_clarity",
  "outdated_information",
  "login_or_otp",
  "form_or_validation",
  "payment",
  "document_upload",
  "mobile_usability",
  "language",
  "accessibility",
  "support",
  "other",
]);
export type ExperienceTheme = z.infer<typeof experienceThemeSchema>;
