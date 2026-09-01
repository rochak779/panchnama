import { createHmac } from "node:crypto";

/**
 * Abuse-key derivation (implementation.md section 9.6): "Abuse key: stable
 * HMAC of the request IP using a server-side secret; store only the
 * resulting hash... never the raw IP."
 *
 * IP extraction — documented mechanism and limitations:
 * A Next.js Route Handler's `Request` has no direct access to the
 * underlying socket's remote address (unlike a raw Node `http.Server`), so
 * the client IP must come from a header. This function reads, in order:
 *
 * 1. `x-forwarded-for` — the first (left-most) comma-separated address,
 *    which by convention is the original client. This header is only
 *    trustworthy when a reverse proxy/CDN the deployment controls (e.g.
 *    Vercel's edge network, or an nginx/Cloudflare front door configured
 *    to overwrite rather than append) sets it — a client connecting
 *    directly to a Node process can forge this header freely. This
 *    function cannot distinguish a trusted proxy-set value from a forged
 *    one; that trust boundary must be established at the deployment/infra
 *    layer (e.g. only trusting this header when the connection itself
 *    terminates at a known-controlled proxy), which is out of scope for
 *    this session (no such infrastructure exists yet — see
 *    docs/experience-privacy-and-moderation.md).
 * 2. `x-real-ip` — a common single-value alternative some proxies set
 *    instead of/alongside `x-forwarded-for`.
 * 3. If neither header is present (e.g. local development with no proxy
 *    in front, or a non-browser client that stripped both headers), this
 *    function returns `null` and the caller falls back to a fixed
 *    `"unknown"` bucket string (see `computeAbuseKeyHash` below) — every
 *    such request shares one abuse key, which is a deliberately
 *    conservative behavior (they rate-limit each other) rather than
 *    disabling rate limiting entirely for IP-less requests.
 *
 * Section 9.6 itself names this exact limitation: "shared NAT addresses
 * can combine unrelated visitors and IPv6 address rotation can weaken
 * IP-only limiting... treat the network-derived limit as one
 * privacy-preserving abuse signal, not as identity."
 */
export function extractClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return null;
}

const UNKNOWN_IP_BUCKET = "unknown";

/**
 * Computes the stable abuse-key hash: `HMAC-SHA256(serverSecret, ip)`,
 * hex-encoded. Only this hash is ever passed to
 * `recordAbuseKeyEvent`/`countEventsInWindow` — the raw IP never reaches
 * `packages/database` or any log line (see `route.ts`'s logging
 * discipline).
 */
export function computeAbuseKeyHash(secret: string, ip: string | null): string {
  return createHmac("sha256", secret)
    .update(ip ?? UNKNOWN_IP_BUCKET)
    .digest("hex");
}
