/**
 * Stable error taxonomy — implementation.md section 9.3.
 *
 * This module is pure (no I/O, no network): it only inspects already-thrown
 * JS error objects (as produced by Node's `fetch`/undici, `dns`, or `tls`
 * layers) and classifies them into one of the stable codes below. The actual
 * network calls that produce these errors live in
 * `packages/audit-cli/src/crawl/http-fetcher.ts`.
 *
 * Fidelity notes (see docs/session-log.md "Session 4" for the full
 * breakdown of which codes are exercised by a real local-server test vs.
 * best-effort/documented-only):
 *   - DNS_FAILURE, CONNECT_TIMEOUT (incl. ECONNREFUSED, by convention —
 *     the taxonomy has no separate "connection refused" code), READ_TIMEOUT,
 *     TOO_MANY_REDIRECTS, HTTP_CLIENT_ERROR, HTTP_SERVER_ERROR,
 *     RESPONSE_TOO_LARGE, ROBOTS_DISALLOWED, AUTH_REQUIRED are fully
 *     reachable and tested against local fixture servers.
 *   - TLS_CERT_EXPIRED / TLS_HOST_MISMATCH are classified from Node's actual
 *     TLS error `code`s (`CERT_HAS_EXPIRED`,
 *     `ERR_TLS_CERT_ALTNAME_INVALID`/`HOSTNAME_MISMATCH`) so the mapping
 *     itself is faithful, but are only exercised in tests where a local
 *     self-signed/expired-cert HTTPS fixture is practical to stand up.
 *   - AUTOMATION_BLOCKED and PARSER_FAILURE require content-level analysis
 *     (bot-block page detection, HTML parsing) that Session 5/6 build; this
 *     session cannot detect them from the fetch layer alone and never emits
 *     them. UNSUPPORTED_CONTENT is recorded descriptively (non-HTML content
 *     is not treated as a crawl error at this layer — see frontier.ts) but
 *     is available here for a future caller that does want to flag it.
 *   - INTERNAL_AUDIT_ERROR is the catch-all for any exception this module
 *     cannot classify more specifically.
 *   - BROWSER_AUTOMATION_FAILURE is a Session 6 documented extra (following
 *     the same precedent as SSRF_BLOCKED/SCOPE_EXCLUDED): a Playwright
 *     browser launch/crash/navigation-machinery failure that is not itself
 *     a timeout, block, or auth-wall (those get their own reused codes —
 *     READ_TIMEOUT, AUTOMATION_BLOCKED, AUTH_REQUIRED — per section 9.3's
 *     "reuse existing codes where they map cleanly" instruction). Emitted
 *     only by `packages/audit-cli/src/crawl/browser-fetcher.ts`.
 */

export const CRAWL_ERROR_CODES = [
  "DNS_FAILURE",
  "CONNECT_TIMEOUT",
  "READ_TIMEOUT",
  "TLS_CERT_EXPIRED",
  "TLS_HOST_MISMATCH",
  "TOO_MANY_REDIRECTS",
  "HTTP_CLIENT_ERROR",
  "HTTP_SERVER_ERROR",
  "ROBOTS_DISALLOWED",
  "AUTOMATION_BLOCKED",
  "AUTH_REQUIRED",
  "UNSUPPORTED_CONTENT",
  "RESPONSE_TOO_LARGE",
  "PARSER_FAILURE",
  "INTERNAL_AUDIT_ERROR",
  "SSRF_BLOCKED",
  "SCOPE_EXCLUDED",
  "BROWSER_AUTOMATION_FAILURE",
] as const;

export type CrawlErrorCode = (typeof CRAWL_ERROR_CODES)[number];

export interface ClassifiedError {
  errorCode: CrawlErrorCode;
  errorMessage: string;
}

/** Recursively unwraps `.cause` chains (undici wraps the real Node system
 * error inside `TypeError: fetch failed`'s `.cause`, and DNS lookups that
 * try multiple addresses can wrap failures in an `AggregateError`). Returns
 * the first object that looks like a Node system error (`{ code: string }`). */
function findSystemErrorCode(error: unknown, depth = 0): string | undefined {
  if (error === null || typeof error !== "object" || depth > 5) {
    return undefined;
  }
  const withCode = error as { code?: unknown; cause?: unknown; errors?: unknown };
  if (typeof withCode.code === "string") {
    return withCode.code;
  }
  if (Array.isArray(withCode.errors)) {
    for (const inner of withCode.errors) {
      const found = findSystemErrorCode(inner, depth + 1);
      if (found !== undefined) {
        return found;
      }
    }
  }
  if (withCode.cause !== undefined) {
    return findSystemErrorCode(withCode.cause, depth + 1);
  }
  return undefined;
}

const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_NODATA", "EAI_NONAME"]);
// `UND_ERR_CONNECT_TIMEOUT`/`UND_ERR_HEADERS_TIMEOUT` (added Session 17
// estate-wide crawl, 2026-09-03, after a real run showed the bug this
// fixes): undici has its own internal connect/headers timeouts (default
// ~10s) that fire independently of — and can fire *before* — this
// fetcher's own `AbortController`-based `requestTimeoutMs` abort. When
// undici's internal timeout wins that race, `controller.signal.aborted`
// is false, so the fetcher's own CONNECT_TIMEOUT branch never triggers
// and the error reaches this function instead — verified live against a
// real unreachable host (`cause.code: "UND_ERR_CONNECT_TIMEOUT"`).
// Previously unrecognized, these fell through to INTERNAL_AUDIT_ERROR:
// a genuine "target didn't respond" case mislabeled as an audit-system
// problem, and — since INTERNAL_AUDIT_ERROR isn't in http-fetcher.ts's
// RETRYABLE_CODES — denied the same retry-with-backoff every other
// connect failure gets.
const CONNECT_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);
const TLS_EXPIRED_CODES = new Set(["CERT_HAS_EXPIRED", "ERR_TLS_CERT_HAS_EXPIRED"]);
const TLS_MISMATCH_CODES = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "HOSTNAME_MISMATCH",
  "ERR_TLS_HANDSHAKE_TIMEOUT",
]);

/**
 * Classifies a caught fetch/network error into a stable code. Timeout
 * (`AbortError`) is deliberately NOT classified here — the caller (the
 * fetcher) knows whether the abort happened before headers were received
 * (CONNECT_TIMEOUT) or during body streaming (READ_TIMEOUT), which this
 * function cannot see from the error object alone.
 */
export function classifyNetworkError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const code = findSystemErrorCode(error);

  if (code !== undefined) {
    if (DNS_CODES.has(code)) {
      return { errorCode: "DNS_FAILURE", errorMessage: message };
    }
    if (CONNECT_CODES.has(code)) {
      return { errorCode: "CONNECT_TIMEOUT", errorMessage: message };
    }
    if (TLS_EXPIRED_CODES.has(code)) {
      return { errorCode: "TLS_CERT_EXPIRED", errorMessage: message };
    }
    if (TLS_MISMATCH_CODES.has(code)) {
      return { errorCode: "TLS_HOST_MISMATCH", errorMessage: message };
    }
  }

  return { errorCode: "INTERNAL_AUDIT_ERROR", errorMessage: message };
}

/** Classifies an HTTP response status into an error code, or `undefined` if
 * the status is not itself an error condition (2xx/3xx). Per section 7.1,
 * "Do not classify 401, 403 ... as broken without contextual review" — this
 * function still records the stable code (AUTH_REQUIRED for 401, and 403 is
 * left as HTTP_CLIENT_ERROR, not treated as automation-blocked, since that
 * requires content analysis this layer doesn't do); *interpreting* the code
 * into a finding/severity is a later session's job (section 7). */
export function classifyHttpStatus(status: number): CrawlErrorCode | undefined {
  if (status === 401) {
    return "AUTH_REQUIRED";
  }
  if (status >= 400 && status < 500) {
    return "HTTP_CLIENT_ERROR";
  }
  if (status >= 500) {
    return "HTTP_SERVER_ERROR";
  }
  return undefined;
}
