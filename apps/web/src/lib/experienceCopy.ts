/**
 * Consent, privacy, and moderation copy blocks for the experience
 * submission form and the approved-experience list. Every string here is
 * sourced from `docs/experience-privacy-and-moderation.md` and
 * `SUBMISSION_CONFIRMATION_MESSAGE` (`apps/web/src/lib/apiResponses.ts`) —
 * this module does not invent new policy claims, and no copy here may ever
 * imply Panchnama is an official, government, or verified channel.
 */

/** Intro note shown at the top of the share-an-experience form, before any
 * step or field exists — this is a form-wide framing statement, distinct in
 * scope from PRIVACY_WARNING_COPY below (which is specifically about the
 * step-3 free-text field). Kept as its own named constant, rather than a
 * hardcoded string in the component, so it has exactly one source of truth
 * like every other policy claim in this module. */
export const SHARE_FORM_INTRO_COPY =
  "This form is anonymous. Do not include your name, phone number, or any " +
  "other identifying detail.";

/** Step 3/4 warning: never include personal information in free text. */
export const PRIVACY_WARNING_COPY =
  "Do not include personal information in your description. Panchnama does " +
  "not ask for your name, phone number, email address, application or " +
  "account number, address, or payment details — please leave these out, " +
  "even if you think they would help explain what happened.";

/** Echoes SUBMISSION_CONFIRMATION_MESSAGE's framing: independent research
 * prototype, not an official grievance channel. */
export const NOT_A_GRIEVANCE_CHANNEL_COPY =
  "Panchnama is an independent research prototype, not an official " +
  "government channel or grievance system. It cannot resolve or forward " +
  "your complaint to the portal or department involved — submitting an " +
  "experience here does not report it to anyone who can act on it.";

/** Explains what happens after a citizen submits: human review, possible
 * redaction, no publication guarantee. */
export const CONSENT_TO_PUBLISH_COPY =
  "If you consent to publish, your submission is reviewed by a human " +
  "moderator before anything is shown publicly. A moderator may redact " +
  "part of your description if it appears to contain personal or " +
  "identifying information. Publication is never guaranteed — a " +
  "submission may be rejected and never published.";

/** For the approved-experience list: moderated, not verified, not blended
 * into the audit findings. */
export const MODERATION_DISCLAIMER_COPY =
  "These experiences were shared with Panchnama by members of the public " +
  "and moderated for relevance, privacy, and safety before publication. " +
  "They are not verified, not representative of every user's experience, " +
  "and are never blended into Panchnama's technical audit findings for " +
  "this portal.";

/** Placeholder removal-request contact procedure from the "Requesting
 * removal" section of docs/experience-privacy-and-moderation.md. This is a
 * documented prototype placeholder, not a monitored production inbox. */
export const REMOVAL_CONTACT_COPY =
  "To request removal of a published experience, contact " +
  "privacy@panchnama.example with the portal name and approximate " +
  "submission date so it can be located. This is a placeholder contact " +
  "route for this research prototype, not a monitored production inbox, " +
  "and does not require you to identify yourself beyond what you choose " +
  "to share.";
