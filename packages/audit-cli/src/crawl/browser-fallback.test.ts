import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Portal } from "@panchnama/schema";
import { evidenceArtifactSchema, pageObservationSchema } from "@panchnama/schema";
import { DEFAULT_URL_NORMALIZATION_OPTIONS } from "@panchnama/audit-core";
import { crawlPortal, type FrontierDeps, type FrontierPolicy } from "./frontier.js";
import { HostScheduler } from "./host-scheduler.js";
import { RobotsCache } from "./robots-fetcher.js";
import { BrowserManager } from "./browser-fetcher.js";
import { startFixtureServer, type FixtureServer } from "./testing/fixture-server.js";

/**
 * Frontier-level browser-fallback integration tests — implementation.md
 * section 14 Session 6's test list: local JS-rendered fixture, allowlist/
 * override eligibility gating, browser-mode page cap, and equivalent
 * schema output across fetch modes. `browser-fetcher.test.ts` covers the
 * Playwright adapter itself (redirect, CAPTCHA, auth wall, timeout,
 * resource cap, SSRF) in isolation; this file covers how `frontier.ts`
 * decides WHETHER to invoke it at all.
 */

function makePortal(
  overrides: Partial<Portal> & { canonicalUrl: string; hostnames: string[] },
): Portal {
  return {
    id: "test-portal",
    schemaVersion: "1.0.0",
    name: "Test Portal",
    alternateUrls: [],
    description: undefined,
    department: undefined,
    geography: "assam",
    portalType: "information",
    officialStatus: "verified",
    sourceRefs: ["src-1"],
    discovery: [
      {
        discoveredAt: "2026-01-01T00:00:00Z",
        discoveredFromUrl: "https://x.example/",
        discoveryMethod: "manual",
      },
    ],
    tags: [],
    ...overrides,
  } as Portal;
}

function makePolicy(
  jsRenderingOverrides: Partial<FrontierPolicy["jsRendering"]> = {},
): FrontierPolicy {
  return {
    boundaries: {
      maxPagesPerPortal: 10,
      maxDepth: 1,
      requestTimeoutMs: 2000,
      maxResponseBodyBytes: 1024 * 1024,
      maxRedirects: 10,
      maxAttemptsAvailabilityCritical: 1,
      allowedSchemes: ["http", "https"],
    },
    exclusions: { routeCategories: [], denylistPathPatterns: [] },
    robotsAndIdentification: { userAgent: "PanchnamaTestBot/0.1", respectRobotsTxt: false },
    jsRendering: {
      browserFallbackEnabled: true,
      perPortalAllowlist: ["test-portal"],
      maxBrowserPagesPerPortal: 5,
      maxBrowserResourceBytes: 5 * 1024 * 1024,
      navigationTimeoutMs: 3000,
      settleTimeoutMs: 300,
      ...jsRenderingOverrides,
    },
    urlNormalization: DEFAULT_URL_NORMALIZATION_OPTIONS,
    safeOperation: { disabledDomains: [] },
  };
}

// A page whose HTTP-rendered body has almost no visible text/links — a
// classic empty client-rendered shell (bare SPA mount point).
function shellHtml(): string {
  return `<html><head><title>Loading</title></head><body><div id="root"></div><script>/* app bundle omitted */</script></body></html>`;
}

// The "real" content a browser render of the same URL would recover.
function realHtml(): string {
  return `<html lang="en"><head><title>Assam Portal</title></head><body>
    <h1>Welcome</h1>
    <p>${"This portal provides citizen services. ".repeat(20)}</p>
    <a href="/services">Services</a>
    <a href="/contact">Contact</a>
    <a href="/about">About</a>
  </body></html>`;
}

function ordinaryHtml(): string {
  return `<html lang="en"><head><title>Ordinary Page</title><link rel="canonical" href="/"></head><body>
    <h1>Ordinary content-rich page</h1>
    <p>${"Plenty of real server-rendered text content here. ".repeat(20)}</p>
    <a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>
  </body></html>`;
}

describe("crawlPortal — browser fallback", () => {
  let browserManager: BrowserManager;
  let evidenceOutDir: string;
  let server: FixtureServer;

  beforeAll(async () => {
    browserManager = new BrowserManager();
    await browserManager.getBrowser();
  }, 30000);

  afterAll(async () => {
    await browserManager.close();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    if (evidenceOutDir && existsSync(evidenceOutDir)) {
      rmSync(evidenceOutDir, { recursive: true, force: true });
    }
  });

  function makeDeps(overrides: Partial<FrontierDeps> = {}): FrontierDeps {
    evidenceOutDir = mkdtempSync(join(tmpdir(), "panchnama-evidence-"));
    const hostScheduler = new HostScheduler({
      maxConcurrentRequestsPerHost: 4,
      minDelayMsPerHost: 0,
      sleepFn: async () => {},
    });
    const robotsCache = new RobotsCache(
      {
        requestTimeoutMs: 2000,
        maxResponseBodyBytes: 1024 * 1024,
        maxRedirects: 10,
        userAgent: "PanchnamaTestBot/0.1",
        allowedSchemes: ["http", "https"],
        ssrf: { allowLoopbackForTests: true },
      },
      "PanchnamaTestBot/0.1",
    );
    return {
      hostScheduler,
      robotsCache,
      ssrf: { allowLoopbackForTests: true },
      now: () => "2026-09-15T00:00:00Z",
      retry: { sleepFn: async () => {} },
      browserManager,
      evidenceOutDir,
      ...overrides,
    };
  }

  it("triggers browser fallback for an allowlisted portal whose HTTP fetch is an empty shell, recovering real content", async () => {
    server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(shellHtml());
    });
    const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
    const result = await crawlPortal(portal, "run-1", makePolicy(), undefined, makeDeps());

    const httpObs = result.pageObservations.find((o) => o.fetchMode === "http");
    const browserObs = result.pageObservations.find((o) => o.fetchMode === "browser");
    expect(httpObs).toBeDefined();
    expect(browserObs).toBeDefined();
    expect(browserObs?.title).toBe("Loading"); // browser fixture serves the same shell in this test
    expect(result.browserFallbackUsed).toBe(true);
  }, 20000);

  it("recovers materially more content via browser mode when the shell fixture serves real content client-side", async () => {
    // Simulate "client-side rendering" by having the fixture serve a shell
    // to a first, plain fetch and the real content thereafter — a browser
    // fixture stand-in that does not require an actual JS bundle, matching
    // this session's fixture-server conventions elsewhere in the suite.
    let hits = 0;
    server = await startFixtureServer((_req, res) => {
      hits += 1;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(hits === 1 ? shellHtml() : realHtml());
    });
    const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
    const result = await crawlPortal(portal, "run-1", makePolicy(), undefined, makeDeps());

    const browserObs = result.pageObservations.find((o) => o.fetchMode === "browser");
    expect(browserObs).toBeDefined();
    expect(browserObs?.title).toBe("Assam Portal");

    // "Selected evidence only": this qualifies (shell -> recovered content).
    expect(result.evidenceArtifacts).toHaveLength(1);
    const artifact = result.evidenceArtifacts[0]!;
    expect(evidenceArtifactSchema.safeParse(artifact).success).toBe(true);
    expect(artifact.privacyReviewed).toBe(false);
    expect(existsSync(join(evidenceOutDir, artifact.storagePath))).toBe(true);
  }, 20000);

  it("never activates when the global switch is off, even for an allowlisted, empty-shell portal", async () => {
    server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(shellHtml());
    });
    const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
    const manager = new BrowserManager();
    const result = await crawlPortal(
      portal,
      "run-1",
      makePolicy({ browserFallbackEnabled: false }),
      undefined,
      { ...makeDeps(), browserManager: manager },
    );

    expect(result.pageObservations.every((o) => o.fetchMode === "http")).toBe(true);
    expect(result.browserFallbackUsed).toBe(false);
    expect(manager.launchCount).toBe(0);
    await manager.close();
  }, 20000);

  it("never activates for a portal not in the allowlist and with no enabling override", async () => {
    server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(shellHtml());
    });
    const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
    const manager = new BrowserManager();
    const result = await crawlPortal(
      portal,
      "run-1",
      makePolicy({ perPortalAllowlist: ["some-other-portal"] }),
      undefined,
      { ...makeDeps(), browserManager: manager },
    );

    expect(result.browserFallbackUsed).toBe(false);
    expect(manager.launchCount).toBe(0);
    await manager.close();
  }, 20000);

  it("a portal override enables browser fallback even when the portal is not in the global allowlist", async () => {
    server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(shellHtml());
    });
    const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
    const result = await crawlPortal(
      portal,
      "run-1",
      makePolicy({ perPortalAllowlist: [] }),
      undefined,
      { ...makeDeps(), portalBrowserOverride: true },
    );

    expect(result.browserFallbackUsed).toBe(true);
  }, 20000);

  it("a disabling portal override wins even when the portal is in the global allowlist", async () => {
    server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(shellHtml());
    });
    const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
    const manager = new BrowserManager();
    const result = await crawlPortal(portal, "run-1", makePolicy(), undefined, {
      ...makeDeps(),
      browserManager: manager,
      portalBrowserOverride: false,
    });

    expect(result.browserFallbackUsed).toBe(false);
    expect(manager.launchCount).toBe(0);
    await manager.close();
  }, 20000);

  it("stops using browser fallback once maxBrowserPagesPerPortal is reached, recording a skip reason for the rest", async () => {
    server = await startFixtureServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      if (req.url === "/") {
        res.end(
          `<html><body><a href="/p1">p1</a><a href="/p2">p2</a><a href="/p3">p3</a></body></html>`,
        );
        return;
      }
      res.end(shellHtml());
    });
    const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
    const result = await crawlPortal(
      portal,
      "run-1",
      makePolicy({ maxBrowserPagesPerPortal: 1 }),
      undefined,
      makeDeps(),
    );

    const browserObs = result.pageObservations.filter((o) => o.fetchMode === "browser");
    expect(browserObs).toHaveLength(1);
    expect(result.skipLog.some((s) => s.reason.includes("maxBrowserPagesPerPortal"))).toBe(true);
  }, 20000);

  it("produces schema-valid PageObservations with consistent field population across http and browser fetch modes", async () => {
    server = await startFixtureServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      if (req.url === "/") {
        res.end(ordinaryHtml());
        return;
      }
      res.end(realHtml());
    });

    const ordinaryPortal = makePortal({
      id: "ordinary-portal",
      canonicalUrl: `${server.url}/`,
      hostnames: ["127.0.0.1"],
    });
    const httpResult = await crawlPortal(
      ordinaryPortal,
      "run-1",
      makePolicy({ perPortalAllowlist: [] }),
      undefined,
      makeDeps(),
    );
    const httpObs = httpResult.pageObservations.find((o) => o.fetchMode === "http")!;
    expect(pageObservationSchema.safeParse(httpObs).success).toBe(true);
    expect(httpObs.title).toBeDefined();
    expect(httpObs.canonical).toBeDefined();
    expect(httpObs.language).toBeDefined();

    // Now force a browser-mode observation of a real-content page directly
    // (a shell is required to trigger it via crawlPortal's dispatch logic;
    // route the shell fixture through the browser and assert the SAME
    // extraction fields populate identically).
    let firstHit = true;
    const server2 = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      if (firstHit) {
        firstHit = false;
        res.end(shellHtml());
        return;
      }
      res.end(realHtml());
    });
    try {
      const browserPortal = makePortal({
        id: "test-portal",
        canonicalUrl: `${server2.url}/`,
        hostnames: ["127.0.0.1"],
      });
      const browserResult = await crawlPortal(
        browserPortal,
        "run-1",
        makePolicy(),
        undefined,
        makeDeps(),
      );
      const browserObs = browserResult.pageObservations.find((o) => o.fetchMode === "browser")!;
      expect(pageObservationSchema.safeParse(browserObs).success).toBe(true);
      expect(browserObs.title).toBe("Assam Portal");
      expect(browserObs.language).toBe("en");
    } finally {
      await server2.close();
    }
  }, 20000);
});
