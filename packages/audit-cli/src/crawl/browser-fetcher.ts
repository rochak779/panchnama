import { chromium, type Browser, type BrowserContext } from "playwright";
import { detectAuthWall, detectCaptchaOrBlock, type CrawlErrorCode } from "@panchnama/audit-core";
import { checkSsrf, type SsrfCheckOptions } from "./ssrf.js";
import type { FetchAttemptResult, RedirectChainEntry } from "./http-fetcher.js";

/**
 * Playwright fetch adapter — implementation.md section 4.1 ("Browser
 * fallback: Playwright, used only for explicitly configured JavaScript-
 * rendered portals"), section 6.4, section 12.1 (isolated/ephemeral browser
 * execution), and section 14 Session 6.
 *
 * Common observation interface: this module deliberately produces the SAME
 * `FetchAttemptResult` shape `http-fetcher.ts` produces (imported, not
 * duplicated) so `frontier.ts` can build a `PageObservation` from either
 * result with one code path, and so both fetch modes can be run through the
 * exact same `html-extract.ts` extraction call. The only browser-specific
 * addition is an optional captured `screenshot` buffer, kept out of
 * `FetchAttemptResult` itself (HTTP-mode never has one) via a wrapper type.
 *
 * One Playwright `Browser` process is launched once per crawl run (see
 * `BrowserManager` below) and reused across every browser-mode fetch in
 * that run, for performance — but every single navigation gets a brand
 * new, fully isolated `BrowserContext` (`browser.newContext()`), used for
 * exactly one page load and then closed immediately. This satisfies section
 * 12.1's "keep browser execution isolated and ephemeral": no context, and
 * therefore no cookies/localStorage/sessionStorage, is ever shared across
 * pages or portals.
 *
 * Readiness signal: navigation waits for `domcontentloaded` (fast, reliably
 * fires even on pages with long-polling/streaming connections that would
 * make `load` or `networkidle` hang past the timeout) and then gives the
 * page a short, bounded settle window via `waitForLoadState("networkidle",
 * { timeout: settleMs })` that is allowed to time out silently — client-side
 * rendering frameworks typically finish their initial render well within
 * this window, but a page that keeps long-lived connections open (websockets,
 * polling) will never reach true network-idle, which is exactly why this is
 * a best-effort settle rather than the primary readiness gate. Known
 * limitation: a client-rendered page whose initial content only appears
 * after the settle window (e.g. a deliberately staggered/lazy-loaded
 * skeleton screen) can still be captured as an empty shell by browser mode
 * too — shell detection is a heuristic, not a guarantee, in either fetch
 * mode.
 *
 * SSRF: Playwright does not go through Node's `fetch`, so `ssrf.ts`'s
 * check-then-fetch code path cannot be reused directly. Instead, this
 * module performs the equivalent DNS-resolve-then-check step itself
 * (calling the same `checkSsrf` used by `http-fetcher.ts`) BEFORE
 * `page.goto()` is ever called, refusing to navigate at all if the
 * hostname resolves to a blocked range. Only the entry navigation is
 * checked (matching this session's scope: one browser-mode fetch per
 * page); a page that itself client-redirects to a different host is
 * covered by the final URL still passing through ordinary browser network
 * stack behavior, not a second explicit SSRF check — documented as a
 * known limitation, consistent with `http-fetcher.ts` re-checking each
 * server-side redirect hop but this adapter not re-implementing that same
 * hop-by-hop machinery for client-side navigation.
 *
 * Resource cap (`maxResourceBytes`): Playwright has no simple streaming
 * byte-cap like `fetch`'s reader. This implementation sums the declared
 * `content-length` response header of every response as headers arrive
 * (via `page.on("response")`, which fires before a response's body has
 * necessarily finished downloading) and races that cumulative total
 * against the in-flight `page.goto()` call. The instant the cumulative
 * total exceeds the cap, the browser context is closed immediately,
 * aborting all further in-flight requests and any pending navigation.
 * Documented limitation: a single response that is itself larger than the
 * cap and is already streaming when detected may finish writing to the
 * browser process before the abort takes effect (Playwright's high-level
 * API does not expose a byte-level mid-stream abort the way this fetcher's
 * `readBodyBounded` does for plain HTTP) — the cap reliably stops further
 * requests and prevents runaway *cumulative* download across many
 * resources, which is what section 6.4's "cap browser pages more
 * aggressively" is actually protecting against, but is not a byte-perfect
 * single-response guarantee. A response with no `content-length` header
 * contributes zero to the running total until a later response reveals
 * one, since Playwright's `response` event does not report bytes-received
 * without also awaiting the (potentially large) body.
 *
 * Proven mechanism (see `browser-fetcher.test.ts`'s resource-cap case): a
 * fixture serves a `content-length` header declaring a payload far larger
 * than the cap and then stalls the body indefinitely without ever
 * finishing it. The fetcher still returns `RESPONSE_TOO_LARGE` well within
 * the test timeout, off the declared header alone — proving the cap does
 * not wait for (or need) the full body to enforce the limit.
 */

export interface BrowserFetchOptions {
  navigationTimeoutMs: number;
  /** Extra bounded time given to `networkidle` after `domcontentloaded`
   * fires, before giving up and reading whatever rendered. */
  settleTimeoutMs: number;
  maxResourceBytes: number;
  userAgent: string;
  allowedSchemes: string[];
  /** TEST-ONLY SSRF bypass, threaded through to `checkSsrf`. Never set from
   * the `crawl` CLI command path. */
  ssrf?: SsrfCheckOptions;
  /** Capture a full-page screenshot on this attempt. Callers decide
   * whether to *keep* it as an `EvidenceArtifact` based on the "selected
   * evidence only" trigger condition (see `evidence.ts`); this flag only
   * controls whether Playwright is asked to render one at all, to avoid
   * paying screenshot cost on fetches that will never use it. */
  captureScreenshot?: boolean;
}

export interface BrowserFetchResult extends FetchAttemptResult {
  screenshot?: Buffer;
}

/** Manages a single Playwright `Browser` process, launched lazily and
 * reused across every browser-mode fetch in a crawl run. Never launches
 * more than one browser regardless of how many pages/portals use it —
 * per-navigation isolation comes entirely from fresh `BrowserContext`s, not
 * from separate browser processes. */
export class BrowserManager {
  private browser: Browser | undefined;
  private launching: Promise<Browser> | undefined;

  /** Number of times a real Playwright browser was launched — test-only
   * observability, used to assert "zero browser launches" when browser
   * fallback must never activate. */
  launchCount = 0;

  async getBrowser(): Promise<Browser> {
    if (this.browser !== undefined) {
      return this.browser;
    }
    if (this.launching === undefined) {
      this.launching = chromium.launch({ headless: true }).then((browser) => {
        this.browser = browser;
        this.launchCount += 1;
        return browser;
      });
    }
    return this.launching;
  }

  async close(): Promise<void> {
    if (this.browser !== undefined) {
      await this.browser.close();
      this.browser = undefined;
    }
    this.launching = undefined;
  }
}

function classifyBrowserError(error: unknown): { errorCode: CrawlErrorCode; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (/Timeout \d+ms exceeded/i.test(message) || /timeout/i.test(message)) {
    return { errorCode: "READ_TIMEOUT", message };
  }
  return { errorCode: "BROWSER_AUTOMATION_FAILURE", message };
}

/**
 * Performs a single bounded browser-mode fetch of `requestedUrl`, using a
 * fresh isolated context from `browser`. Never throws for ordinary
 * fetch/navigation failures — those become `errorCode`/`errorMessage` on
 * the returned result, mirroring `fetchOnce`'s contract.
 */
export async function fetchWithBrowser(
  requestedUrl: string,
  browser: Browser,
  options: BrowserFetchOptions,
): Promise<BrowserFetchResult> {
  const start = Date.now();

  let parsed: URL;
  try {
    parsed = new URL(requestedUrl);
  } catch {
    return {
      ok: false,
      requestedUrl,
      finalUrl: requestedUrl,
      redirectChain: [],
      bodyTruncated: false,
      durationMs: Date.now() - start,
      errorCode: "INTERNAL_AUDIT_ERROR",
      errorMessage: `malformed URL: "${requestedUrl}"`,
    };
  }

  const scheme = parsed.protocol.replace(":", "");
  if (!options.allowedSchemes.includes(scheme)) {
    return {
      ok: false,
      requestedUrl,
      finalUrl: requestedUrl,
      redirectChain: [],
      bodyTruncated: false,
      durationMs: Date.now() - start,
      errorCode: "SCOPE_EXCLUDED",
      errorMessage: `scheme "${scheme}" is not in allowedSchemes`,
    };
  }

  const ssrfResult = await checkSsrf(parsed.hostname, options.ssrf);
  if (ssrfResult.blocked) {
    return {
      ok: false,
      requestedUrl,
      finalUrl: requestedUrl,
      redirectChain: [],
      bodyTruncated: false,
      durationMs: Date.now() - start,
      errorCode: "SSRF_BLOCKED",
      errorMessage: ssrfResult.reason,
    };
  }

  let context: BrowserContext | undefined;
  try {
    // 12.1 isolation: a brand-new context per navigation, never shared or
    // reused — no cookies/storage can leak across portals or pages.
    context = await browser.newContext({ userAgent: options.userAgent });
    const page = await context.newPage();

    let totalResourceBytes = 0;
    let capExceeded = false;
    let capExceededResolve: (() => void) | undefined;
    const capExceededPromise = new Promise<void>((resolve) => {
      capExceededResolve = resolve;
    });

    page.on("response", (response) => {
      const contentLength = response.headers()["content-length"];
      if (contentLength !== undefined) {
        const size = Number(contentLength);
        if (Number.isFinite(size)) {
          totalResourceBytes += size;
        }
      }
      if (totalResourceBytes > options.maxResourceBytes && !capExceeded) {
        capExceeded = true;
        capExceededResolve?.();
      }
    });

    const redirectChain: RedirectChainEntry[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && frame.url() !== requestedUrl) {
        redirectChain.push({ url: frame.url() });
      }
    });

    let navResponse: Awaited<ReturnType<typeof page.goto>> = null;
    let capAborted = false;
    try {
      navResponse = await Promise.race([
        page.goto(requestedUrl, {
          waitUntil: "domcontentloaded",
          timeout: options.navigationTimeoutMs,
        }),
        capExceededPromise.then(() => {
          capAborted = true;
          return null;
        }),
      ]);
    } catch (error) {
      const classified = classifyBrowserError(error);
      return {
        ok: false,
        requestedUrl,
        finalUrl: page.url() || requestedUrl,
        redirectChain,
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: classified.errorCode,
        errorMessage: classified.message,
      };
    }

    if (capAborted) {
      return {
        ok: false,
        requestedUrl,
        finalUrl: page.url() || requestedUrl,
        redirectChain,
        bodyTruncated: true,
        durationMs: Date.now() - start,
        errorCode: "RESPONSE_TOO_LARGE",
        errorMessage: `cumulative response size exceeded maxBrowserResourceBytes (${options.maxResourceBytes}) — navigation aborted`,
      };
    }

    // Best-effort settle window for client-side rendering to finish; a
    // page that never reaches network-idle (long-polling, websockets)
    // simply times out here silently and we read whatever has rendered.
    await page.waitForLoadState("networkidle", { timeout: options.settleTimeoutMs }).catch(() => {
      // Deliberately ignored — see doc comment above.
    });

    if (capExceeded) {
      return {
        ok: false,
        requestedUrl,
        finalUrl: page.url() || requestedUrl,
        redirectChain,
        bodyTruncated: true,
        durationMs: Date.now() - start,
        errorCode: "RESPONSE_TOO_LARGE",
        errorMessage: `cumulative response size exceeded maxBrowserResourceBytes (${options.maxResourceBytes}) during settle`,
      };
    }

    const finalUrl = page.url();
    const httpStatus = navResponse?.status();
    const contentType = (await navResponse?.headerValue("content-type")) ?? undefined;
    const bodyText = await page.content();

    let screenshot: Buffer | undefined;
    if (options.captureScreenshot === true) {
      try {
        screenshot = await page.screenshot({ fullPage: true, type: "png" });
      } catch {
        // Screenshot capture is best-effort evidence, never fatal to the
        // fetch itself.
        screenshot = undefined;
      }
    }

    const authWall = detectAuthWall(bodyText, finalUrl);
    if (authWall.detected) {
      return {
        ok: false,
        requestedUrl,
        finalUrl,
        redirectChain,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(contentType !== undefined ? { contentType } : {}),
        bodyText,
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: "AUTH_REQUIRED",
        errorMessage: authWall.reason,
        ...(screenshot !== undefined ? { screenshot } : {}),
      };
    }

    const block = detectCaptchaOrBlock(bodyText);
    if (block.detected) {
      return {
        ok: false,
        requestedUrl,
        finalUrl,
        redirectChain,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(contentType !== undefined ? { contentType } : {}),
        bodyText,
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: "AUTOMATION_BLOCKED",
        errorMessage: block.reason,
        ...(screenshot !== undefined ? { screenshot } : {}),
      };
    }

    return {
      ok: true,
      requestedUrl,
      finalUrl,
      redirectChain,
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      ...(contentType !== undefined ? { contentType } : {}),
      bodyText,
      bodyTruncated: false,
      durationMs: Date.now() - start,
      ...(screenshot !== undefined ? { screenshot } : {}),
    };
  } catch (error) {
    const classified = classifyBrowserError(error);
    return {
      ok: false,
      requestedUrl,
      finalUrl: requestedUrl,
      redirectChain: [],
      bodyTruncated: false,
      durationMs: Date.now() - start,
      errorCode: classified.errorCode,
      errorMessage: classified.message,
    };
  } finally {
    if (context !== undefined) {
      await context.close().catch(() => {
        // Ephemeral context teardown failure is not itself a fetch error.
      });
    }
  }
}
