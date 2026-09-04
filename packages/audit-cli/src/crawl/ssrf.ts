import { lookup } from "node:dns/promises";
import { isBlockedIpAddress } from "@panchnama/audit-core";

/**
 * SSRF guard — implementation.md section 12.1: "Block requests to
 * loopback, link-local, private, and metadata-service IP ranges to
 * mitigate SSRF if URLs ever become configurable by untrusted users."
 *
 * This is the DNS-resolve-then-check step: it performs a real DNS lookup
 * (not a string match on the hostname, since a hostname can resolve to a
 * private IP even when the string itself looks public) and rejects if any
 * resolved address is blocked.
 *
 * Test-only bypass: `allowLoopbackForTests` lets the test suite exercise
 * the fetcher against its own local fixture HTTP servers (which are
 * necessarily on loopback) without weakening the real check. The
 * production `crawl` CLI command path (`commands/crawl.ts`) never sets
 * this flag — it is only ever passed explicitly by test code that
 * constructs a fetcher/frontier directly. Grep for
 * `allowLoopbackForTests` before changing this contract.
 *
 * `retryable` (added Session 17 estate-wide crawl, 2026-09-03, after a
 * real run showed the bug this fixes): a DNS lookup that *fails to
 * resolve at all* (throws, or returns zero addresses) is NOT the same
 * fact as "we resolved it and it points at a blocked range" — the first
 * is "we couldn't determine safety" (still fails closed — the caller
 * still never fetches), the second is a genuine, permanent security
 * determination. Conflating them previously meant a single transient DNS
 * hiccup (observed for real during a live crawl: known-good, previously
 * smoke-tested hosts like `police.assam.gov.in` failed their lookup once
 * and were permanently marked `SSRF_BLOCKED` with zero retries, exactly
 * like a deliberate security block) got zero retries and a misleading
 * "SSRF check" label in the evidence trail, when it should have gotten
 * the same 3-attempts-with-backoff fairness (implementation.md section
 * 6.1) any other network failure gets. `retryable: true` lets the caller
 * (`fetchOnce`) route this case to the ordinary `DNS_FAILURE` code
 * instead of the permanent `SSRF_BLOCKED` code — same fail-closed
 * behavior (still refuses to fetch), honest labeling, real retries.
 */
export interface SsrfCheckOptions {
  /** TEST-ONLY. Never set from the `crawl` CLI command. */
  allowLoopbackForTests?: boolean;
  /** Injectable for tests; defaults to the real `dns.lookup`. */
  lookupFn?: typeof lookup;
}

export type SsrfCheckResult =
  | { blocked: false }
  | { blocked: true; reason: string; retryable?: boolean };

export async function checkSsrf(
  hostname: string,
  options: SsrfCheckOptions = {},
): Promise<SsrfCheckResult> {
  if (options.allowLoopbackForTests === true) {
    return { blocked: false };
  }

  const lookupFn = options.lookupFn ?? lookup;
  let addresses: { address: string }[];
  try {
    const result = await lookupFn(hostname, { all: true });
    addresses = Array.isArray(result) ? result : [result];
  } catch (error) {
    return {
      blocked: true,
      reason: `DNS resolution failed: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
    };
  }

  if (addresses.length === 0) {
    return { blocked: true, reason: "DNS resolution returned no addresses", retryable: true };
  }

  for (const { address } of addresses) {
    if (isBlockedIpAddress(address)) {
      return {
        blocked: true,
        reason: `hostname "${hostname}" resolves to blocked address ${address} (loopback/link-local/private/metadata range)`,
      };
    }
  }

  return { blocked: false };
}
