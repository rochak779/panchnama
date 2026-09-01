/**
 * Origin/CSRF protection for `POST /api/experiences` (implementation.md
 * section 9.8: "Add CSRF/origin protections appropriate to the deployment
 * model even without authentication").
 *
 * Mechanism: this app has no session cookies, no authentication, and no
 * server-rendered anti-CSRF token — there is no user identity to hijack,
 * so a classic CSRF-token scheme would protect nothing real. The actual
 * risk this guards against is a third-party page silently driving a
 * browser to POST spam/abuse traffic at this endpoint using the victim's
 * network address (which would consume their rate-limit budget) or at
 * volume. A same-origin check is the right-sized protection for that
 * threat model: compare the browser-supplied `Origin` header's host (or,
 * when `Origin` is absent, the `Referer` header's host — some older
 * browsers and some same-site navigations omit `Origin` on POST) against
 * the request's own `Host` header, and reject any mismatch.
 *
 * Explicit coverage/limitations:
 * - Rejects cross-origin browser POSTs (the CSRF threat this exists for).
 * - Does NOT protect against a non-browser client (curl, a server-side
 *   script) that fabricates a matching `Origin`/`Host` pair — there is no
 *   authentication token this check could tie to a legitimate session, so
 *   this is deliberately a coarse bot/CSRF speed bump layered with the
 *   honeypot, rate limiting, and duplicate detection, not a strong
 *   identity boundary.
 * - A request with neither `Origin` nor `Referer` is rejected outright
 *   (conservative default). This means a legitimate non-browser API
 *   client that omits both headers cannot use this endpoint — an accepted
 *   tradeoff for a public anonymous form endpoint with no auth to fall
 *   back on, and consistent with "no authentication system" being a
 *   deliberate product decision (section 9.6).
 */
export function isSameOriginRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    return hostMatches(origin, host);
  }

  const referer = request.headers.get("referer");
  if (referer) {
    return hostMatches(referer, host);
  }

  return false;
}

function hostMatches(url: string, host: string): boolean {
  try {
    return new URL(url).host === host;
  } catch {
    return false;
  }
}
