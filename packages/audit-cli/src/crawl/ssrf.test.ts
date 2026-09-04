import { describe, expect, it } from "vitest";
import { checkSsrf } from "./ssrf.js";

describe("checkSsrf", () => {
  it("blocks a hostname that resolves to a loopback address", async () => {
    const result = await checkSsrf("localhost", {
      lookupFn: (async () => [{ address: "127.0.0.1", family: 4 }]) as never,
    });
    expect(result.blocked).toBe(true);
  });

  it("blocks a hostname that resolves to a private address even though the string looks public", async () => {
    // The real-world SSRF-relevant case: a public-looking hostname that
    // resolves internally (DNS rebinding / internal aliasing).
    const result = await checkSsrf("internal.example.com", {
      lookupFn: (async () => [{ address: "10.0.0.5", family: 4 }]) as never,
    });
    expect(result.blocked).toBe(true);
  });

  it("allows a hostname resolving to a public address", async () => {
    const result = await checkSsrf("example.com", {
      lookupFn: (async () => [{ address: "93.184.216.34", family: 4 }]) as never,
    });
    expect(result.blocked).toBe(false);
  });

  it("blocks if any of multiple resolved addresses is private", async () => {
    const result = await checkSsrf("mixed.example.com", {
      lookupFn: (async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]) as never,
    });
    expect(result.blocked).toBe(true);
  });

  it("fails closed on DNS resolution error, marked retryable (not a permanent security determination)", async () => {
    // Regression test: a real Session 17 crawl run found known-good,
    // previously-verified-reachable hosts (e.g. police.assam.gov.in)
    // getting permanently marked SSRF_BLOCKED with zero retries after a
    // single transient DNS hiccup — because a lookup *failure* was
    // conflated with a lookup that *succeeded and resolved to a blocked
    // IP*. Still fails closed (blocked: true, never proceeds to fetch),
    // but the caller (http-fetcher.ts) uses `retryable` to route this to
    // the ordinary retryable DNS_FAILURE code instead of the permanent
    // SSRF_BLOCKED code.
    const result = await checkSsrf("broken.example.com", {
      lookupFn: (async () => {
        throw new Error("ENOTFOUND");
      }) as never,
    });
    expect(result.blocked).toBe(true);
    expect(result.blocked && result.retryable).toBe(true);
  });

  it("fails closed with retryable:true when DNS resolution returns zero addresses", async () => {
    const result = await checkSsrf("empty.example.com", {
      lookupFn: (async () => []) as never,
    });
    expect(result.blocked).toBe(true);
    expect(result.blocked && result.retryable).toBe(true);
  });

  it("does NOT mark retryable when a hostname genuinely resolves to a blocked address", async () => {
    // A successful lookup that resolves to a private/loopback address is
    // a real, permanent security determination — retrying won't change
    // it, and it must never be conflated with a lookup failure.
    const result = await checkSsrf("internal.example.com", {
      lookupFn: (async () => [{ address: "10.0.0.5", family: 4 }]) as never,
    });
    expect(result.blocked).toBe(true);
    expect(result.blocked && result.retryable).toBeUndefined();
  });

  it("test-only override bypasses the check entirely", async () => {
    const result = await checkSsrf("localhost", { allowLoopbackForTests: true });
    expect(result.blocked).toBe(false);
  });

  it("performs a real DNS lookup against loopback when no override or lookupFn is given", async () => {
    const result = await checkSsrf("localhost");
    expect(result.blocked).toBe(true);
  });
});
