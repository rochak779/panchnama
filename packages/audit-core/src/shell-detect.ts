/**
 * Empty client-rendered shell detection — implementation.md section 6.4
 * ("the HTTP response is successful but contains no meaningful navigational
 * content") and section 14 Session 6 ("Detection heuristic for empty
 * client-rendered shells, with manual override").
 *
 * Pure function over cheap, pre-computed signals (visible text length, link
 * count, presence of a common SPA mount-point element, and the raw HTML byte
 * size) rather than over raw HTML/DOM — HTML parsing is Cheerio's job
 * (`packages/audit-cli/src/crawl/html-extract.ts`, which stays the single
 * source of extraction logic per this session's brief). Keeping this
 * decision pure and dependency-free makes it directly unit-testable without
 * a DOM parser.
 *
 * IMPORTANT ordering note (see docs/session-log.md and the frontier's own
 * call site): this heuristic must only ever be evaluated for a portal that
 * `isBrowserFallbackEligible` has already approved. Evaluating it first, or
 * unconditionally, would let an empty-shell page on a non-allowlisted
 * portal accidentally justify a browser launch — the eligibility gate is
 * checked first, always, with the heuristic applied only within that
 * boundary.
 *
 * Thresholds are deliberately conservative and documented, not tuned
 * against a large corpus:
 *   - `visibleTextLength` under `MIN_VISIBLE_TEXT_LENGTH` (200 characters)
 *     is treated as "mostly empty."
 *   - `linkCount` under `MIN_LINK_COUNT` (3) is treated as "no meaningful
 *     navigation," matching section 6.4's literal "no meaningful
 *     navigational content" test.
 *   - A page is a shell only when BOTH are true, unless a known SPA
 *     mount-point marker (`hasAppRootMarker`, e.g. `<div id="app">`/
 *     `<div id="root">` with no other body content) is present, in which
 *     case a slightly higher text threshold (400 characters) alone is
 *     sufficient, since a bare mount point is strong independent evidence.
 *
 * Known false-positive/false-negative limits (documented per the task
 * brief, not fixed this session):
 *   - False positive: a legitimately minimal but complete static page (e.g.
 *     a single-purpose redirect notice, or a very short "service
 *     unavailable" notice) can trip these thresholds and be mistaken for a
 *     shell, triggering an unnecessary (but harmless, capped) browser
 *     fallback attempt.
 *   - False negative: a client-rendered page that pre-renders a plausible
 *     amount of boilerplate chrome (nav bar, footer, cookie banner) via
 *     server-side rendering or a static shell template, while still hiding
 *     its actual primary content behind client-side JS, will not trigger
 *     this heuristic because raw text/link counts look adequate.
 */
export interface ShellSignals {
  /** Length (in characters) of visible text content extracted from `<body>`,
   * with scripts/styles excluded and whitespace collapsed. */
  visibleTextLength: number;
  /** Number of `<a href>` elements found on the page. */
  linkCount: number;
  /** True when the body is dominated by a single common SPA root/mount
   * element (`#app`, `#root`, `#__next`, etc.) with little else. */
  hasAppRootMarker: boolean;
  /** Raw HTML byte length, for context/logging only — not itself part of
   * the decision, since a large HTML payload can still be devoid of
   * navigational content (e.g. a large inlined JS bundle). */
  htmlByteLength: number;
}

export interface ShellDetectionResult {
  isEmptyShell: boolean;
  reason: string;
}

const MIN_VISIBLE_TEXT_LENGTH = 200;
const MIN_LINK_COUNT = 3;
const APP_ROOT_TEXT_LENGTH = 400;

export function detectEmptyShell(signals: ShellSignals): ShellDetectionResult {
  if (signals.hasAppRootMarker && signals.visibleTextLength < APP_ROOT_TEXT_LENGTH) {
    return {
      isEmptyShell: true,
      reason: `page body is dominated by a single SPA mount-point element with only ${signals.visibleTextLength} characters of visible text (< ${APP_ROOT_TEXT_LENGTH})`,
    };
  }

  const sparseText = signals.visibleTextLength < MIN_VISIBLE_TEXT_LENGTH;
  const sparseLinks = signals.linkCount < MIN_LINK_COUNT;

  if (sparseText && sparseLinks) {
    return {
      isEmptyShell: true,
      reason: `only ${signals.visibleTextLength} characters of visible text (< ${MIN_VISIBLE_TEXT_LENGTH}) and ${signals.linkCount} link(s) (< ${MIN_LINK_COUNT}) — no meaningful navigational content`,
    };
  }

  return {
    isEmptyShell: false,
    reason: `sufficient content observed (${signals.visibleTextLength} characters of text, ${signals.linkCount} link(s))`,
  };
}
