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

  it("fails closed on DNS resolution error", async () => {
    const result = await checkSsrf("broken.example.com", {
      lookupFn: (async () => {
        throw new Error("ENOTFOUND");
      }) as never,
    });
    expect(result.blocked).toBe(true);
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
