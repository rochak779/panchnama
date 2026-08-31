/**
 * Authentication-wall, CAPTCHA, and bot-block detection — implementation.md
 * section 14 Session 6 ("Authentication/CAPTCHA/block detection resulting in
 * `not_assessable`") and section 9.3's error taxonomy (`AUTH_REQUIRED`,
 * `AUTOMATION_BLOCKED`).
 *
 * Pure, best-effort, string-matching heuristics over already-rendered HTML
 * and the final navigated URL — no DOM parsing, no network. Deliberately
 * conservative pattern lists rather than a claim of complete coverage; see
 * the documented known limitations on each function.
 *
 * These functions do not themselves decide `PageObservation.errorCode` —
 * the caller (`browser-fetcher.ts`) maps their results to the reused stable
 * codes: an auth-wall match -> `AUTH_REQUIRED`, a CAPTCHA/bot-block match ->
 * `AUTOMATION_BLOCKED` (matching Session 4's existing taxonomy intent
 * rather than inventing new codes).
 */

export interface DetectionResult {
  detected: boolean;
  reason: string;
}

const AUTH_URL_PATTERN =
  /\/(login|log-in|signin|sign-in|auth|authenticate|account\/login|sso)(?:[/?#]|$)/i;

const PASSWORD_FIELD_PATTERN = /<input[^>]+type=["']?password["']?/i;
const USERNAME_FIELD_PATTERN =
  /<input[^>]+(?:name|id)=["']?(username|user_name|user-id|loginid|login_id)["']?/i;

/**
 * Heuristic: the browser was redirected to a URL whose path looks like a
 * login/auth route, OR the rendered page contains a password input field
 * (optionally alongside a recognizable username field).
 *
 * Known limitations: URL-pattern matching misses auth walls hosted at
 * unconventional paths (e.g. a portal-specific `/citizen-portal/enter`);
 * the password-field check misses auth walls implemented as a client-side
 * redirect to a third-party IdP that itself fails to render in time, and
 * can false-positive on an unrelated page that happens to embed an
 * incidental password field (e.g. a "change your account password"
 * marketing screenshot embedded as literal markup — rare, but possible).
 */
export function detectAuthWall(html: string, finalUrl: string): DetectionResult {
  let urlLooksLikeAuth = false;
  try {
    urlLooksLikeAuth = AUTH_URL_PATTERN.test(new URL(finalUrl).pathname);
  } catch {
    urlLooksLikeAuth = AUTH_URL_PATTERN.test(finalUrl);
  }

  const hasPasswordField = PASSWORD_FIELD_PATTERN.test(html);
  const hasUsernameField = USERNAME_FIELD_PATTERN.test(html);

  if (urlLooksLikeAuth && hasPasswordField) {
    return {
      detected: true,
      reason: `final URL path looks like a login route and the page contains a password field`,
    };
  }
  if (hasPasswordField && hasUsernameField) {
    return {
      detected: true,
      reason: `page contains both a password field and a recognizable username field`,
    };
  }
  if (urlLooksLikeAuth) {
    return {
      detected: true,
      reason: `final URL path matches a common login/auth route pattern`,
    };
  }

  return { detected: false, reason: "no login/auth-wall signal detected" };
}

// Best-effort, well-known CAPTCHA-provider markup signatures.
const CAPTCHA_PATTERNS: RegExp[] = [
  /recaptcha/i,
  /g-recaptcha/i,
  /hcaptcha/i,
  /h-captcha/i,
  /cf-turnstile/i,
  /captcha-delivery\.com/i, // DataDome
  /funcaptcha/i,
  /arkoselabs/i,
];

// Best-effort bot/automation-block interstitial phrasing (case-insensitive
// substrings deliberately kept short and specific to reduce false
// positives on ordinary error pages).
const BOT_BLOCK_PATTERNS: RegExp[] = [
  /access denied/i,
  /automated (queries|requests|access)/i,
  /unusual traffic/i,
  /please verify you are a human/i,
  /verify you are human/i,
  /checking your browser before accessing/i,
  /pardon the interruption/i,
  /request blocked/i,
];

/**
 * Heuristic: the rendered page contains a recognizable CAPTCHA-provider
 * script/iframe/widget signature, or common bot-block interstitial phrasing.
 *
 * Known limitations: only recognizes a fixed, documented list of common
 * CAPTCHA providers and English-language interstitial phrasing — a custom
 * or non-English block page will not be detected; conversely, a page that
 * merely *mentions* CAPTCHA or bot-detection in ordinary prose (e.g. a
 * government advisory about phishing) could, in principle, false-positive,
 * though the chosen phrases are deliberately specific to reduce that risk.
 */
export function detectCaptchaOrBlock(html: string): DetectionResult {
  const captchaMatch = CAPTCHA_PATTERNS.find((pattern) => pattern.test(html));
  if (captchaMatch !== undefined) {
    return {
      detected: true,
      reason: `page contains a recognizable CAPTCHA-provider signature (matched ${captchaMatch.source})`,
    };
  }

  const blockMatch = BOT_BLOCK_PATTERNS.find((pattern) => pattern.test(html));
  if (blockMatch !== undefined) {
    return {
      detected: true,
      reason: `page contains bot-block interstitial phrasing (matched ${blockMatch.source})`,
    };
  }

  return { detected: false, reason: "no CAPTCHA or bot-block signal detected" };
}
