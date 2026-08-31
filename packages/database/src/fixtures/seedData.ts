import { SEED_TAG_PREFIX } from "../constants.js";
import { FIXTURE_PORTAL_IDS } from "./portals.js";
import type { ModerationDecision } from "../repository/moderation.js";
import type { NewSubmissionInput } from "../repository/submissions.js";

/**
 * Deterministic development/test seed rows. Each has a stable `seedKey`
 * (`SEED_TAG_PREFIX-<key>`) so `db:seed` can find and replace exactly its
 * own rows on a second run without touching any other data — see
 * `src/scripts/seed.ts`'s "delete rows whose seed_key starts with the
 * prefix, then reinsert" idempotency mechanism.
 *
 * Portal ids are the two Session 1 fixture portals
 * (`FIXTURE_PORTAL_IDS`), so seeded submissions are always valid against
 * `isFixturePortalId`.
 */
export interface SeedSubmission {
  seedKey: string;
  input: Omit<NewSubmissionInput, "seedKey">;
  /** Omit for a submission that should stay `pending` after seeding. */
  decision?: { decision: ModerationDecision; reasonCode?: string; publicText?: string };
}

const [portalA, portalB] = FIXTURE_PORTAL_IDS;

export const SEED_SUBMISSIONS: SeedSubmission[] = [
  {
    seedKey: `${SEED_TAG_PREFIX}-pending-1`,
    input: {
      portalId: portalA,
      taskType: "general_information",
      taskDescription: "Looked up department contact details.",
      outcome: "completed",
      themes: ["navigation"],
      deviceType: "desktop",
      experienceRating: 4,
      freeText: "Found the contact page after a couple of clicks.",
      consentToPublish: true,
      source: "public_form",
      privacyFlags: [],
    },
  },
  {
    seedKey: `${SEED_TAG_PREFIX}-approved-1`,
    input: {
      portalId: portalB,
      taskType: "scheme_enrollment",
      taskDescription: "Tried to enroll for a fertilizer subsidy scheme.",
      outcome: "not_completed",
      themes: ["availability", "form_or_validation"],
      deviceType: "mobile",
      experienceRating: 2,
      freeText: "The enrollment page kept timing out on my phone.",
      consentToPublish: true,
      source: "public_form",
      privacyFlags: [],
    },
    decision: {
      decision: "approved",
      reasonCode: "approved_relevant",
    },
  },
  {
    seedKey: `${SEED_TAG_PREFIX}-approved-redacted-1`,
    input: {
      portalId: portalB,
      taskType: "scheme_status_check",
      taskDescription: "Checked application status.",
      outcome: "partially_completed",
      themes: ["content_clarity", "support"],
      deviceType: "desktop",
      experienceRating: 3,
      freeText: "Call the helpline at 98765 43210 if the status page is blank, like mine was.",
      consentToPublish: true,
      source: "public_form",
      privacyFlags: ["possible_phone_number"],
    },
    decision: {
      decision: "approved",
      reasonCode: "approved_redacted",
      publicText: "Contact the helpline if the status page is blank, like mine was.",
    },
  },
  {
    seedKey: `${SEED_TAG_PREFIX}-rejected-1`,
    input: {
      portalId: portalA,
      taskType: "other",
      taskDescription: "Unrelated comment.",
      outcome: "information_only",
      themes: ["other"],
      consentToPublish: true,
      source: "public_form",
      privacyFlags: [],
    },
    decision: {
      decision: "rejected",
      reasonCode: "rejected_not_relevant",
    },
  },
  {
    seedKey: `${SEED_TAG_PREFIX}-needs-redaction-1`,
    input: {
      portalId: portalA,
      taskType: "general_information",
      outcome: "completed",
      themes: ["language"],
      freeText: "Site only in English, my Aadhaar is 1234 5678 9012 fyi.",
      consentToPublish: true,
      source: "research_interview",
      privacyFlags: ["possible_aadhaar"],
    },
    decision: {
      decision: "needs_redaction",
      reasonCode: "needs_redaction_identity_number",
      publicText: "Site is only available in English.",
    },
  },
];
