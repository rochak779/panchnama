/**
 * Central place for the small set of tunable numbers this package uses, so
 * none of them are scattered as magic literals inside repository/CLI code.
 * Defaults follow implementation.md section 9.8's recommended retention
 * policy and section 9.6's rolling abuse-key window; every default can be
 * overridden via environment variables (see `src/env.ts`).
 */

/** Reason codes recognised for moderation and enum-mirroring CHECK constraints. */
export const EXPERIENCE_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "needs_redaction",
] as const;

export const TASK_OUTCOME_VALUES = [
  "completed",
  "partially_completed",
  "not_completed",
  "information_only",
] as const;

export const EXPERIENCE_THEME_VALUES = [
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
] as const;

export const DEVICE_TYPE_VALUES = ["mobile", "desktop", "tablet", "other"] as const;

export const SUBMISSION_SOURCE_VALUES = ["public_form", "research_interview"] as const;

/** implementation.md section 9.8: "delete rejected original submissions
 * after 90 days". Overridable via EXPERIENCE_RETENTION_REJECTED_DAYS. */
export const DEFAULT_RETENTION_REJECTED_DAYS = 90;

/** implementation.md section 9.8: "expired abuse keys within 24 hours" —
 * this is the TTL applied when an abuse-key event row is written, not the
 * retention sweep's own cadence. Overridable via
 * EXPERIENCE_ABUSE_KEY_TTL_HOURS. */
export const DEFAULT_ABUSE_KEY_TTL_HOURS = 24;

/**
 * Minimum number of approved+consented experiences a portal needs before a
 * `PortalExperienceSummary` is shown without a "small sample" caveat. Not
 * specified numerically in implementation.md; chosen as a conservative,
 * documented default consistent with section 10.6's "sampling limitations"
 * disclosure requirement. The web layer (Session 10+) decides how to word
 * the caveat; this package only sets the boolean flag.
 */
export const MINIMUM_DISPLAY_THRESHOLD = 5;

/** Free-text length bounds, mirrored exactly from
 * packages/schema/src/experience.ts's `.max()` calls so Zod and the
 * database's `varchar(n)` columns can never drift apart. */
export const TASK_DESCRIPTION_MAX_LENGTH = 280;
export const FREE_TEXT_MAX_LENGTH = 1000;

/** Prefix stamped onto every row `db:seed` creates, so the seed script can
 * find (and safely delete-and-reinsert) exactly its own rows on a second
 * run without touching real submissions. See `src/fixtures/seedData.ts`. */
export const SEED_TAG_PREFIX = "session9-seed";
