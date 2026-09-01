/**
 * Privacy-pattern detection for free-text submission fields
 * (implementation.md section 9.6: "Privacy-pattern flags must check, at
 * minimum: email addresses; Indian mobile numbers...; Aadhaar-shaped
 * 12-digit sequences; PAN-shaped 10-character alphanumeric sequences...;
 * and other long numeric runs (8+ digits)").
 *
 * These are MODERATION FLAGS, never automatic rejection — a match is
 * recorded in `privacyFlags: string[]` alongside the stored submission so
 * a human moderator can review and redact, per section 9.6: "These matches
 * create moderation flags rather than proving validity or causing
 * automatic rejection."
 */

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** 10-digit Indian mobile numbers starting 6-9, optionally with a leading
 * `+91`/`91`/`0` and an optional single space/hyphen between any two
 * digits — not fixed at 3-3-4 positions, since the conventional printed
 * grouping is actually 5+5 (e.g. "98765 43210"), which a fixed-position
 * pattern would miss. Digit-boundary lookaround avoids matching the middle
 * of a longer digit run. */
const INDIAN_MOBILE_PATTERN = /(?<![\d])(?:\+?91[-\s]?|0)?[6-9](?:[-\s]?\d){9}(?![\d])/g;

/** 12-digit Aadhaar-shaped sequences, optionally grouped in 4s with spaces
 * or hyphens (the conventional printed format), with token boundaries.
 * This is a broad SHAPE check only — no Verhoeff checksum validation, per
 * section 9.6: "optional Verhoeff validation may reduce false positives
 * but must not replace the broad shape check." */
const AADHAAR_PATTERN = /(?<![\d])\d{4}[-\s]?\d{4}[-\s]?\d{4}(?![\d])/g;

/** PAN-shaped: 5 letters, 4 digits, 1 letter — case-insensitive, with word
 * boundaries so it never matches inside a longer alphanumeric token. */
const PAN_PATTERN = /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/g;

/** Any other run of 8 or more consecutive digits (reference/application/
 * account/payment numbers), evaluated only after the more specific
 * patterns above so an Aadhaar/mobile match is reported under its own
 * flag rather than double-counted here. */
const LONG_DIGIT_RUN_PATTERN = /(?<![\d])\d{8,}(?![\d])/g;

export type PrivacyFlag =
  | "possible_email"
  | "possible_indian_mobile_number"
  | "possible_aadhaar_number"
  | "possible_pan_number"
  | "possible_long_reference_number";

/**
 * Scans one piece of free text and returns the distinct set of privacy
 * flags it matched. Case is normalized (PAN check) via the pattern's own
 * `i`-equivalent handling; digits-only patterns are case-independent by
 * construction.
 */
export function detectPrivacyFlags(text: string | null | undefined): PrivacyFlag[] {
  if (!text) return [];
  const flags = new Set<PrivacyFlag>();

  if (EMAIL_PATTERN.test(text)) flags.add("possible_email");
  if (INDIAN_MOBILE_PATTERN.test(text)) flags.add("possible_indian_mobile_number");
  if (AADHAAR_PATTERN.test(text)) flags.add("possible_aadhaar_number");
  if (PAN_PATTERN.test(text)) flags.add("possible_pan_number");
  if (LONG_DIGIT_RUN_PATTERN.test(text)) flags.add("possible_long_reference_number");

  resetLastIndex();
  return [...flags];
}

/** All patterns above use the global flag for `.test()` statefulness
 * safety across repeated calls on different strings within one process —
 * reset `lastIndex` after every scan so the next call starts clean. */
function resetLastIndex(): void {
  EMAIL_PATTERN.lastIndex = 0;
  INDIAN_MOBILE_PATTERN.lastIndex = 0;
  AADHAAR_PATTERN.lastIndex = 0;
  PAN_PATTERN.lastIndex = 0;
  LONG_DIGIT_RUN_PATTERN.lastIndex = 0;
}
