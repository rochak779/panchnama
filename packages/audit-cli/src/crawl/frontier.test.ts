import { describe, expect, it } from "vitest";
import type { Portal } from "@panchnama/schema";
import { DEFAULT_URL_NORMALIZATION_OPTIONS } from "@panchnama/audit-core";
import { crawlPortal, type FrontierPolicy } from "./frontier.js";
import { HostScheduler } from "./host-scheduler.js";
import { RobotsCache } from "./robots-fetcher.js";
import type { HttpFetcherOptions } from "./http-fetcher.js";
import { startFixtureServer, type FixtureServer } from "./testing/fixture-server.js";

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

function makePolicy(overrides: Partial<FrontierPolicy["boundaries"]> = {}): FrontierPolicy {
  return {
    boundaries: {
      maxPagesPerPortal: 40,
      maxDepth: 2,
      requestTimeoutMs: 1000,
      maxResponseBodyBytes: 1024 * 1024,
      maxRedirects: 10,
      maxAttemptsAvailabilityCritical: 1,
      allowedSchemes: ["http", "https"],
      ...overrides,
    },
    exclusions: { routeCategories: [], denylistPathPatterns: [] },
    robotsAndIdentification: { userAgent: "PanchnamaTestBot/0.1", respectRobotsTxt: true },
    jsRendering: {
      browserFallbackEnabled: false,
      perPortalAllowlist: [],
      maxBrowserPagesPerPortal: 2,
      maxBrowserResourceBytes: 1024 * 1024,
      navigationTimeoutMs: 2000,
      settleTimeoutMs: 200,
    },
    urlNormalization: DEFAULT_URL_NORMALIZATION_OPTIONS,
    safeOperation: { disabledDomains: [] },
  };
}

function makeDeps(_server: FixtureServer, retryOverrides: Partial<HttpFetcherOptions> = {}) {
  const hostScheduler = new HostScheduler({
    maxConcurrentRequestsPerHost: 4,
    minDelayMsPerHost: 0,
    sleepFn: async () => {},
  });
  const fetcherOptionsBase: HttpFetcherOptions = {
    requestTimeoutMs: 1000,
    maxResponseBodyBytes: 1024 * 1024,
    maxRedirects: 10,
    userAgent: "PanchnamaTestBot/0.1",
    allowedSchemes: ["http", "https"],
    ssrf: { allowLoopbackForTests: true },
    ...retryOverrides,
  };
  const robotsCache = new RobotsCache(fetcherOptionsBase, "PanchnamaTestBot/0.1");
  return {
    hostScheduler,
    robotsCache,
    ssrf: { allowLoopbackForTests: true },
    now: () => "2026-09-15T00:00:00Z",
    retry: { sleepFn: async () => {} },
  };
}

function htmlPage(links: string[]): string {
  return `<html><body>${links.map((l) => `<a href="${l}">link</a>`).join("")}</body></html>`;
}

describe("crawlPortal", () => {
  it("walks the frontier within maxDepth and records page observations", async () => {
    const server = await startFixtureServer((req, res) => {
      const url = req.url;
      res.writeHead(200, { "Content-Type": "text/html" });
      if (url === "/") {
        res.end(htmlPage(["/a"]));
      } else if (url === "/a") {
        res.end(htmlPage(["/b"]));
      } else if (url === "/b") {
        res.end(htmlPage(["/c"]));
      } else {
        res.end(htmlPage([]));
      }
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const result = await crawlPortal(
        portal,
        "run-1",
        makePolicy({ maxDepth: 2 }),
        undefined,
        makeDeps(server),
      );
      const fetchedUrls = result.pageObservations.map((o) => o.requestedUrl);
      expect(fetchedUrls).toContain(`${server.url}/`);
      expect(fetchedUrls).toContain(`${server.url}/a`);
      expect(fetchedUrls).toContain(`${server.url}/b`);
      // /c is discovered from /b, which is depth 2 — its own depth would be
      // 3, beyond maxDepth 2, so it must never be fetched.
      expect(fetchedUrls).not.toContain(`${server.url}/c`);
      expect(result.status).toBe("succeeded");
    } finally {
      await server.close();
    }
  });

  it("stops exactly at maxPagesPerPortal", async () => {
    const server = await startFixtureServer((req, res) => {
      const n = Number(req.url?.slice(1) || "0");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage([`/${n + 1}`]));
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/0`, hostnames: ["127.0.0.1"] });
      const result = await crawlPortal(
        portal,
        "run-1",
        makePolicy({ maxDepth: 10, maxPagesPerPortal: 3 }),
        undefined,
        makeDeps(server),
      );
      expect(result.pageObservations.length).toBe(3);
      expect(result.skipLog.some((s) => s.reason.includes("maxPagesPerPortal"))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("respects robots.txt disallow for deeper paths while allowing the homepage", async () => {
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("User-agent: *\nDisallow: /deep\n");
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage(["/deep/page"]));
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const result = await crawlPortal(portal, "run-1", makePolicy(), undefined, makeDeps(server));
      const home = result.pageObservations.find((o) => o.requestedUrl === `${server.url}/`);
      expect(home?.robotsDecision).toBe("allowed");
      expect(home?.httpStatus).toBe(200);
      const deep = result.pageObservations.find(
        (o) => o.requestedUrl === `${server.url}/deep/page`,
      );
      expect(deep?.robotsDecision).toBe("disallowed");
      expect(deep?.httpStatus).toBeUndefined();
      expect(deep?.errorCode).toBeUndefined();
      expect(result.status).toBe("succeeded");
    } finally {
      await server.close();
    }
  });

  it("does not crawl an out-of-scope hostname", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage(["http://not-registered.example/other"]));
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const result = await crawlPortal(portal, "run-1", makePolicy(), undefined, makeDeps(server));
      expect(result.pageObservations.some((o) => o.requestedUrl.includes("not-registered"))).toBe(
        false,
      );
      expect(result.skipLog.some((s) => s.url.includes("not-registered"))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("dry run makes zero HTTP requests", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage(["/a"]));
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const result = await crawlPortal(portal, "run-1", makePolicy(), undefined, {
        ...makeDeps(server),
        dryRun: true,
      });
      expect(server.requestCount).toBe(0);
      expect(result.plannedUrls).toContain(`${server.url}/`);
      expect(result.pageObservations.length).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("marks the portal as failed when the entry URL cannot be fetched", async () => {
    const portal = makePortal({
      canonicalUrl: "http://127.0.0.1:59999/",
      hostnames: ["127.0.0.1"],
    });
    const dummyServer = { url: "http://127.0.0.1:59999", requestCount: 0 } as FixtureServer;
    const result = await crawlPortal(
      portal,
      "run-1",
      makePolicy({ requestTimeoutMs: 500 }),
      undefined,
      makeDeps(dummyServer),
    );
    expect(result.status).toBe("failed");
    expect(result.pageObservations[0]?.errorCode).toBeDefined();
  });
});
