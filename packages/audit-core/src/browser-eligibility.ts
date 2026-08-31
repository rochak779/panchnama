/**
 * Browser-fallback eligibility gate — implementation.md section 6.4 ("Browser
 * rendering is an allowlisted fallback only when...") and section 14 Session 6
 * ("Portal-level configuration enabling browser fallback ... never activates
 * globally without policy approval").
 *
 * Pure decision function: given the global switch, the global per-portal
 * allowlist, and an optional per-portal override, decides whether a given
 * portal is *eligible* for browser-mode fallback at all. This is strictly a
 * policy gate — it says nothing about whether a *specific page* on an
 * eligible portal should actually be fetched with a browser (that is the
 * shell-detection heuristic in `shell-detect.ts`, which must only ever be
 * consulted for a portal this function already says is eligible).
 *
 * Documented interpretation of override + allowlist interaction (the task
 * brief leaves this to the implementer's judgment):
 *
 *   1. `globalEnabled: false` is an absolute kill switch. No override, no
 *      allowlist entry, nothing can turn browser fallback on when the global
 *      switch is off. This is what makes "never activates globally without
 *      policy approval" true even if a stale/misconfigured per-portal file
 *      says otherwise.
 *   2. When the global switch is on, an explicit per-portal override is the
 *      most specific available signal and wins over the allowlist in either
 *      direction: `overrideEnabled: true` enables a portal even if it is not
 *      in `perPortalAllowlist` (this is the "manual override" the spec asks
 *      for — a human editing one portal's config file); `overrideEnabled:
 *      false` disables a portal even if it *is* in `perPortalAllowlist`
 *      (an explicit "no" always wins over a blanket "yes").
 *   3. With no override file, or an override file that does not set
 *      `browserFallbackEnabled` at all, eligibility falls back to plain
 *      allowlist membership.
 */
export interface BrowserEligibilityInput {
  globalEnabled: boolean;
  perPortalAllowlist: readonly string[];
  portalId: string;
  /** `undefined` when no override file exists for this portal, or the file
   * exists but does not set `overrides.browserFallbackEnabled`. */
  overrideEnabled?: boolean;
}

export interface BrowserEligibilityResult {
  eligible: boolean;
  reason: string;
}

export function isBrowserFallbackEligible(
  input: BrowserEligibilityInput,
): BrowserEligibilityResult {
  if (!input.globalEnabled) {
    return {
      eligible: false,
      reason: "crawlPolicy.jsRendering.browserFallbackEnabled is false (global kill switch)",
    };
  }

  if (input.overrideEnabled === true) {
    return {
      eligible: true,
      reason: `portal override explicitly enables browser fallback for "${input.portalId}"`,
    };
  }
  if (input.overrideEnabled === false) {
    return {
      eligible: false,
      reason: `portal override explicitly disables browser fallback for "${input.portalId}"`,
    };
  }

  if (input.perPortalAllowlist.includes(input.portalId)) {
    return {
      eligible: true,
      reason: `portal "${input.portalId}" is in jsRendering.perPortalAllowlist`,
    };
  }

  return {
    eligible: false,
    reason: `portal "${input.portalId}" is not in jsRendering.perPortalAllowlist and has no enabling override`,
  };
}
