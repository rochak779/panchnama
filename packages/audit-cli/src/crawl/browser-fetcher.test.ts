import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserManager, fetchWithBrowser, type BrowserFetchOptions } from "./browser-fetcher.js";
import { startFixtureServer } from "./testing/fixture-server.js";
import type { Browser } from "playwright";

const DEFAULT_OPTIONS: BrowserFetchOptions = {
  navigationTimeoutMs: 3000,
  settleTimeoutMs: 300,
  maxResourceBytes: 5 * 1024 * 1024,
  userAgent: "PanchnamaTestBot/0.1",
  allowedSchemes: ["http", "https"],
  ssrf: { allowLoopbackForTests: true },
};

describe("fetchWithBrowser", () => {
  let manager: BrowserManager;
  let browser: Browser;

  beforeAll(async () => {
    manager = new BrowserManager();
    browser = await manager.getBrowser();
  }, 30000);

  afterAll(async () => {
    await manager.close();
  });

  it("fetches a normal page and returns rendered content", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html lang="en"><head><title>Hello Browser</title></head><body><h1>Real Content</h1><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a></body></html>`,
      );
    });
    try {
      const result = await fetchWithBrowser(server.url + "/", browser, DEFAULT_OPTIONS);
      expect(result.ok).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(result.bodyText).toContain("Real Content");
      expect(result.bodyText).toContain("Hello Browser");
    } finally {
      await server.close();
    }
  }, 15000);

  it("reflects the final URL after a client-side redirect", async () => {
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body><script>location.href = "/destination";</script></body></html>`);
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><head><title>Destination</title></head><body>You made it</body></html>`);
    });
    try {
      const result = await fetchWithBrowser(server.url + "/", browser, DEFAULT_OPTIONS);
      expect(result.ok).toBe(true);
      expect(result.finalUrl).toBe(`${server.url}/destination`);
      expect(result.bodyText).toContain("You made it");
    } finally {
      await server.close();
    }
  }, 15000);

  it("detects a CAPTCHA-like block and records AUTOMATION_BLOCKED", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html><body><h1>Please verify</h1><div class="g-recaptcha" data-sitekey="x"></div></body></html>`,
      );
    });
    try {
      const result = await fetchWithBrowser(server.url + "/", browser, DEFAULT_OPTIONS);
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("AUTOMATION_BLOCKED");
    } finally {
      await server.close();
    }
  }, 15000);

  it("detects an auth wall and records AUTH_REQUIRED", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html><body><form><input type="text" id="username"><input type="password" name="pw"></form></body></html>`,
      );
    });
    try {
      const result = await fetchWithBrowser(`${server.url}/login`, browser, DEFAULT_OPTIONS);
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("AUTH_REQUIRED");
    } finally {
      await server.close();
    }
  }, 15000);

  it("aborts cleanly with a timeout classification when navigation never settles", async () => {
    const server = await startFixtureServer((_req, res) => {
      // Never respond — headers are sent late enough that `domcontentloaded`
      // cannot fire within the short timeout below.
      res.writeHead(200, { "Content-Type": "text/html" });
      // Deliberately do not call res.end() or res.write() further.
    });
    try {
      const result = await fetchWithBrowser(server.url + "/", browser, {
        ...DEFAULT_OPTIONS,
        navigationTimeoutMs: 500,
      });
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("READ_TIMEOUT");
    } finally {
      await server.close();
    }
  }, 15000);

  it("aborts based on a declared Content-Length exceeding maxResourceBytes, without waiting for the full body", async () => {
    const declaredSize = 5_000_000; // 5 MB declared, well over the cap below
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Length": String(declaredSize),
      });
      // Write a small amount and then stall — the body never actually
      // reaches `declaredSize` bytes and never finishes. If the fetcher
      // waited for the full body before enforcing the cap, this test would
      // time out; instead, the cap must fire off the declared
      // `content-length` header alone, well before the (stalled) body ever
      // arrives.
      res.write("<html><body>");
    });
    try {
      const result = await fetchWithBrowser(server.url + "/", browser, {
        ...DEFAULT_OPTIONS,
        maxResourceBytes: 1_000_000, // 1 MB cap, well under the declared 5 MB
        navigationTimeoutMs: 5000,
      });
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("RESPONSE_TOO_LARGE");
    } finally {
      await server.close();
    }
  }, 15000);

  it("refuses to navigate to a loopback address when SSRF checking is not bypassed", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body>should never be seen</body></html>`);
    });
    try {
      const result = await fetchWithBrowser(server.url + "/", browser, {
        ...DEFAULT_OPTIONS,
        ssrf: {}, // no test bypass — real DNS-based SSRF check applies
      });
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe("SSRF_BLOCKED");
      expect(server.requestCount).toBe(0);
    } finally {
      await server.close();
    }
  }, 15000);
});

describe("BrowserManager", () => {
  it("never launches a browser until getBrowser() is called", () => {
    const manager = new BrowserManager();
    expect(manager.launchCount).toBe(0);
  });

  it("reuses one browser instance across multiple getBrowser() calls", async () => {
    const manager = new BrowserManager();
    try {
      const first = await manager.getBrowser();
      const second = await manager.getBrowser();
      expect(first).toBe(second);
      expect(manager.launchCount).toBe(1);
    } finally {
      await manager.close();
    }
  }, 15000);
});
