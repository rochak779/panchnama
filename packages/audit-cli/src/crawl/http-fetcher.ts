import {
  classifyHttpStatus,
  classifyNetworkError,
  type CrawlErrorCode,
} from "@panchnama/audit-core";
import { checkSsrf, type SsrfCheckOptions } from "./ssrf.js";

/**
 * Bounded, polite HTTP fetcher — implementation.md section 4.1 (native
 * `fetch`/Undici), section 6.1 (timeouts/redirects/body size), section 6.6
 * (GET/HEAD only, no cookies), section 9.3 (typed errors), section 12.1
 * (SSRF/scheme restriction/response size limits).
 *
 * Redirect handling: uses `redirect: "manual"` and follows hops itself
 * (rather than letting `fetch` opaquely auto-follow) specifically so the
 * full chain with intermediate statuses can be captured for
 * `PageObservation.redirectChain`, and so each hop can be re-checked for
 * scheme/SSRF before being followed (a redirect can point anywhere,
 * including a private IP — the SSRF check must re-run per hop, not just on
 * the original URL).
 *
 * Timeout phases: `requestTimeoutMs` is applied twice, sequentially — once
 * while waiting for a response's headers (an abort here is classified
 * CONNECT_TIMEOUT), and again while streaming the response body (an abort
 * here is classified READ_TIMEOUT). This distinguishes "the server never
 * answered" from "the server started answering but stalled," which a
 * single whole-request timeout could not.
 *
 * No cookie jar: `fetch`'s `credentials` defaults to same-origin per spec
 * but Node's implementation does not persist cookies across calls unless
 * the caller wires one up, and this fetcher never does — each call is a
 * fresh, stateless request, satisfying "never store cookies, tokens ...
 * across requests" (section 6.6). `Set-Cookie` response headers are never
 * read.
 */

export interface HttpFetcherOptions {
  requestTimeoutMs: number;
  maxResponseBodyBytes: number;
  maxRedirects: number;
  userAgent: string;
  allowedSchemes: string[];
  method?: "GET" | "HEAD";
  /** TEST-ONLY SSRF bypass, threaded through to `checkSsrf`. Never set from
   * the `crawl` CLI command path. */
  ssrf?: SsrfCheckOptions;
}

export interface RedirectChainEntry {
  url: string;
  status?: number;
}

export interface FetchAttemptResult {
  ok: boolean;
  requestedUrl: string;
  finalUrl: string;
  redirectChain: RedirectChainEntry[];
  httpStatus?: number;
  contentType?: string;
  bodyText?: string;
  bodyTruncated: boolean;
  durationMs: number;
  errorCode?: CrawlErrorCode;
  errorMessage?: string;
}

/** Reads a response body up to `maxBytes`, aborting the underlying request
 * (via the shared `controller`) once exceeded rather than buffering it all
 * first, and separately enforcing `timeoutMs` for the streaming phase
 * itself (distinct from the connect-phase timeout already spent getting
 * headers). Always decodes the (bounded) body as UTF-8 text — the fetcher
 * itself is content-type-agnostic; callers (the frontier, for HTML link
 * discovery; robots-fetcher, for `text/plain` robots.txt) decide what to
 * do with the text based on `contentType`. Content-type-based "don't treat
 * this as a crawlable page" filtering (section 14 Session 4 item 7)
 * happens in the frontier, not here. */
async function readBodyBounded(
  response: Response,
  maxBytes: number,
  controller: AbortController,
  timeoutMs: number,
): Promise<{ text: string; tooLarge: boolean; timedOut: boolean }> {
  if (response.body === null) {
    return { text: "", tooLarge: false, timedOut: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let tooLarge = false;
  let timedOut = false;
  const readTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        tooLarge = true;
        controller.abort();
        try {
          await reader.cancel();
        } catch {
          // already aborted; ignore
        }
        break;
      }
      chunks.push(value);
    }
  } catch {
    // Reader errored — either our own tooLarge abort() above (already
    // handled by breaking the loop before the throw could happen in the
    // common case) or the readTimer's abort(); `timedOut`/`tooLarge`
    // already record which.
  } finally {
    clearTimeout(readTimer);
  }

  const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  return { text, tooLarge, timedOut };
}

/**
 * Performs a single bounded fetch attempt (following redirects up to
 * `maxRedirects`, but not retrying). See `fetchWithRetry` for the
 * retry/backoff wrapper used for availability-critical requests.
 */
export async function fetchOnce(
  requestedUrl: string,
  options: HttpFetcherOptions,
): Promise<FetchAttemptResult> {
  const start = Date.now();
  const redirectChain: RedirectChainEntry[] = [];
  const method = options.method ?? "GET";

  let currentUrl = requestedUrl;
  let hops = 0;

  while (true) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return {
        ok: false,
        requestedUrl,
        finalUrl: currentUrl,
        redirectChain,
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: "INTERNAL_AUDIT_ERROR",
        errorMessage: `malformed URL: "${currentUrl}"`,
      };
    }

    const scheme = parsed.protocol.replace(":", "");
    if (!options.allowedSchemes.includes(scheme)) {
      return {
        ok: false,
        requestedUrl,
        finalUrl: currentUrl,
        redirectChain,
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: "SCOPE_EXCLUDED",
        errorMessage: `scheme "${scheme}" is not in allowedSchemes`,
      };
    }

    const ssrfResult = await checkSsrf(parsed.hostname, options.ssrf);
    if (ssrfResult.blocked) {
      // A DNS lookup that failed to resolve at all (ssrf.ts's
      // `retryable: true`) is a network failure, not a security
      // determination — route it to the ordinary retryable DNS_FAILURE
      // code so it gets the same 3-attempts-with-backoff fairness as any
      // other network hiccup. Still fails closed either way: this branch
      // never proceeds to fetch.
      return {
        ok: false,
        requestedUrl,
        finalUrl: currentUrl,
        redirectChain,
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: ssrfResult.retryable === true ? "DNS_FAILURE" : "SSRF_BLOCKED",
        errorMessage: ssrfResult.reason,
      };
    }

    const controller = new AbortController();
    let headersReceived = false;
    const connectTimer = setTimeout(() => controller.abort(), options.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": options.userAgent },
      });
      headersReceived = true;
      clearTimeout(connectTimer);
    } catch (error) {
      clearTimeout(connectTimer);
      if (controller.signal.aborted && !headersReceived) {
        return {
          ok: false,
          requestedUrl,
          finalUrl: currentUrl,
          redirectChain,
          bodyTruncated: false,
          durationMs: Date.now() - start,
          errorCode: "CONNECT_TIMEOUT",
          errorMessage: `no response within ${options.requestTimeoutMs}ms`,
        };
      }
      const classified = classifyNetworkError(error);
      return {
        ok: false,
        requestedUrl,
        finalUrl: currentUrl,
        redirectChain,
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
      };
    }

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get("location");

    if (isRedirect && location !== null) {
      // Redirect responses have no meaningful body for our purposes;
      // release the connection without buffering it.
      try {
        await response.body?.cancel();
      } catch {
        // ignore
      }
      redirectChain.push({ url: currentUrl, status: response.status });
      hops += 1;
      if (hops > options.maxRedirects) {
        return {
          ok: false,
          requestedUrl,
          finalUrl: currentUrl,
          redirectChain,
          httpStatus: response.status,
          bodyTruncated: false,
          durationMs: Date.now() - start,
          errorCode: "TOO_MANY_REDIRECTS",
          errorMessage: `exceeded maxRedirects (${options.maxRedirects})`,
        };
      }
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        return {
          ok: false,
          requestedUrl,
          finalUrl: currentUrl,
          redirectChain,
          httpStatus: response.status,
          bodyTruncated: false,
          durationMs: Date.now() - start,
          errorCode: "INTERNAL_AUDIT_ERROR",
          errorMessage: `redirect Location header is malformed: "${location}"`,
        };
      }
      currentUrl = nextUrl;
      continue;
    }

    // Final (non-redirect) response — read the body under a second,
    // independent timeout for the streaming phase, reusing the same
    // AbortController so a timeout here actually tears down the
    // in-flight read (not just abandons a promise).
    const contentType = response.headers.get("content-type") ?? undefined;
    const bodyResult = await readBodyBounded(
      response,
      options.maxResponseBodyBytes,
      controller,
      options.requestTimeoutMs,
    );

    if (bodyResult.timedOut) {
      return {
        ok: false,
        requestedUrl,
        finalUrl: currentUrl,
        redirectChain,
        httpStatus: response.status,
        ...(contentType !== undefined ? { contentType } : {}),
        bodyTruncated: false,
        durationMs: Date.now() - start,
        errorCode: "READ_TIMEOUT",
        errorMessage: `body read exceeded ${options.requestTimeoutMs}ms`,
      };
    }

    if (bodyResult.tooLarge) {
      return {
        ok: false,
        requestedUrl,
        finalUrl: currentUrl,
        redirectChain,
        httpStatus: response.status,
        ...(contentType !== undefined ? { contentType } : {}),
        bodyTruncated: true,
        durationMs: Date.now() - start,
        errorCode: "RESPONSE_TOO_LARGE",
        errorMessage: `response body exceeded maxResponseBodyBytes (${options.maxResponseBodyBytes})`,
      };
    }

    const statusErrorCode = classifyHttpStatus(response.status);
    return {
      ok: statusErrorCode === undefined,
      requestedUrl,
      finalUrl: currentUrl,
      redirectChain,
      httpStatus: response.status,
      ...(contentType !== undefined ? { contentType } : {}),
      bodyText: bodyResult.text,
      bodyTruncated: false,
      durationMs: Date.now() - start,
      ...(statusErrorCode !== undefined
        ? { errorCode: statusErrorCode, errorMessage: `HTTP ${response.status}` }
        : {}),
    };
  }
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  /** Injectable so tests don't wait through real backoff delays. */
  sleepFn?: (ms: number) => Promise<void>;
  /** Injectable jitter source (0..1); defaults to `Math.random`. */
  randomFn?: () => number;
}

const RETRYABLE_CODES = new Set<CrawlErrorCode>([
  "DNS_FAILURE",
  "CONNECT_TIMEOUT",
  "READ_TIMEOUT",
  "HTTP_SERVER_ERROR",
]);

export interface FetchWithRetryResult extends FetchAttemptResult {
  attempts: number;
}

/**
 * Retries `fetchOnce` with exponential backoff + jitter for
 * availability-critical errors (network/timeout/5xx) — implementation.md
 * section 6.1 ("Maximum 3 attempts for availability-critical requests,
 * with backoff") and section 9.3. Non-retryable outcomes (4xx, TLS errors,
 * TOO_MANY_REDIRECTS, SSRF/scope rejections, or any 2xx/3xx-resolved
 * success) return immediately on the first attempt.
 */
export async function fetchWithRetry(
  requestedUrl: string,
  fetcherOptions: HttpFetcherOptions,
  retryOptions: RetryOptions,
): Promise<FetchWithRetryResult> {
  const sleepFn = retryOptions.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const randomFn = retryOptions.randomFn ?? Math.random;

  let attempt = 1;
  while (true) {
    const result = await fetchOnce(requestedUrl, fetcherOptions);
    const shouldRetry =
      !result.ok &&
      result.errorCode !== undefined &&
      RETRYABLE_CODES.has(result.errorCode) &&
      attempt < retryOptions.maxAttempts;

    if (!shouldRetry) {
      return { ...result, attempts: attempt };
    }

    const backoff = retryOptions.baseDelayMs * 2 ** (attempt - 1);
    const jitter = randomFn() * retryOptions.baseDelayMs;
    await sleepFn(backoff + jitter);
    attempt += 1;
  }
}
