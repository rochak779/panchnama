import { describe, expect, it } from "vitest";
import type { Portal } from "@panchnama/schema";
import { DEFAULT_URL_NORMALIZATION_OPTIONS } from "@panchnama/audit-core";
import { checkPortalLinks, type LinkCheckPolicy } from "./link-check.js";
import type { LinkOccurrence } from "./frontier.js";
import { HostScheduler } from "./host-scheduler.js";
import { startFixtureServer } from "./testing/fixture-server.js";

function makePortal(overrides: Partial<Portal> & { hostnames: string[] }): Portal {
  return {
    id: "test-portal",
    schemaVersion: "1.0.0",
    name: "Test Portal",
    canonicalUrl: "https://portal.example/",
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

function makePolicy(overrides: Partial<LinkCheckPolicy["exclusions"]> = {}): LinkCheckPolicy {
  return {
    urlNormalization: DEFAULT_URL_NORMALIZATION_OPTIONS,
    exclusions: {
      routeCategories: ["login"],
      denylistPathPatterns: [],
      excludedUrlSchemes: ["mailto", "tel", "javascript", "data"],
      ...overrides,
    },
    safeOperation: { disabledDomains: [] },
    boundaries: {
      requestTimeoutMs: 1000,
      maxResponseBodyBytes: 1024 * 1024,
      maxRedirects: 10,
      maxAttemptsAvailabilityCritical: 2,
      allowedSchemes: ["http", "https"],
    },
    robotsAndIdentification: { userAgent: "PanchnamaTestBot/0.1" },
  };
}

function makeDeps() {
  return {
    hostScheduler: new HostScheduler({
      maxConcurrentRequestsPerHost: 4,
      minDelayMsPerHost: 0,
      sleepFn: async () => {},
    }),
    ssrf: { allowLoopbackForTests: true },
    now: () => "2026-09-15T00:00:00Z",
    retry: { sleepFn: async () => {}, randomFn: () => 0 },
  };
}

describe("checkPortalLinks", () => {
  it("checks a broken internal link and records a useful error code", async () => {
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/missing") {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200);
      res.end("ok");
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const occurrences: LinkOccurrence[] = [
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "/missing",
          resolvedUrl: `${server.url}/missing`,
          anchorText: "Broken link",
        },
      ];
      const observations = await checkPortalLinks(
        portal,
        "run-1",
        occurrences,
        makePolicy(),
        makeDeps(),
      );
      expect(observations).toHaveLength(1);
      expect(observations[0]?.relationship).toBe("internal");
      expect(observations[0]?.status).toBe("fail");
      expect(observations[0]?.httpStatus).toBe(404);
      expect(observations[0]?.errorCode).toBe("HTTP_CLIENT_ERROR");
      expect(observations[0]?.attempts).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it("checks a broken external link and classifies it as external", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(500);
      res.end();
    });
    try {
      const portal = makePortal({ hostnames: ["portal.example"] });
      const occurrences: LinkOccurrence[] = [
        {
          portalId: portal.id,
          sourcePageUrl: "https://portal.example/",
          rawHref: server.url,
          resolvedUrl: `${server.url}/`,
        },
      ];
      const observations = await checkPortalLinks(
        portal,
        "run-1",
        occurrences,
        makePolicy(),
        makeDeps(),
      );
      expect(observations).toHaveLength(1);
      expect(observations[0]?.relationship).toBe("external");
      expect(observations[0]?.status).toBe("fail");
      expect(observations[0]?.errorCode).toBe("HTTP_SERVER_ERROR");
    } finally {
      await server.close();
    }
  });

  it("false HEAD failure: HEAD returns 405 but GET succeeds -> recorded as reachable", async () => {
    const server = await startFixtureServer((req, res) => {
      if (req.method === "HEAD") {
        res.writeHead(405);
        return res.end();
      }
      res.writeHead(200);
      res.end("ok");
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const occurrences: LinkOccurrence[] = [
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "/head-rejected",
          resolvedUrl: `${server.url}/head-rejected`,
        },
      ];
      const observations = await checkPortalLinks(
        portal,
        "run-1",
        occurrences,
        makePolicy(),
        makeDeps(),
      );
      expect(observations[0]?.status).toBe("pass");
      expect(observations[0]?.httpStatus).toBe(200);
      // one HEAD attempt + one GET attempt
      expect(observations[0]?.attempts).toBe(2);
    } finally {
      await server.close();
    }
  });

  it("deduplicates repeated destinations at the network layer, preserving one LinkObservation per source page", async () => {
    let requestCount = 0;
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/shared") {
        requestCount += 1;
      }
      res.writeHead(200);
      res.end("ok");
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const occurrences: LinkOccurrence[] = [
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/page-a`,
          rawHref: "/shared?utm_source=x",
          resolvedUrl: `${server.url}/shared?utm_source=x`,
          anchorText: "From A",
        },
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/page-b`,
          rawHref: "/shared",
          resolvedUrl: `${server.url}/shared`,
          anchorText: "From B",
        },
      ];
      const observations = await checkPortalLinks(
        portal,
        "run-1",
        occurrences,
        makePolicy(),
        makeDeps(),
      );
      expect(observations).toHaveLength(2);
      expect(new Set(observations.map((o) => o.normalizedDestinationUrl)).size).toBe(1);
      expect(observations.map((o) => o.sourcePageUrl).sort()).toEqual(
        [`${server.url}/page-a`, `${server.url}/page-b`].sort(),
      );
      expect(observations.every((o) => o.status === "pass")).toBe(true);
      // Only ONE actual HEAD request should have hit /shared despite two occurrences.
      expect(requestCount).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("excluded-category links (mail/tel/js/data, and route-category paths) never generate an HTTP request", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const occurrences: LinkOccurrence[] = [
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "mailto:someone@example.org",
          resolvedUrl: "mailto:someone@example.org",
        },
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "tel:+911234567890",
          resolvedUrl: "tel:+911234567890",
        },
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "javascript:void(0)",
          resolvedUrl: "javascript:void(0)",
        },
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "/login",
          resolvedUrl: `${server.url}/login`,
        },
      ];
      const observations = await checkPortalLinks(
        portal,
        "run-1",
        occurrences,
        makePolicy(),
        makeDeps(),
      );
      expect(observations).toHaveLength(4);
      expect(observations.every((o) => o.status === "not_applicable")).toBe(true);
      expect(observations.every((o) => o.errorCode === "SCOPE_EXCLUDED")).toBe(true);
      expect(observations.every((o) => o.attempts === 0)).toBe(true);
      expect(server.requestCount).toBe(0);
    } finally {
      await server.close();
    }
  });

  it("records a non-HTML target's check result without treating it specially", async () => {
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/doc.pdf") {
        res.writeHead(200, { "Content-Type": "application/pdf" });
        return res.end("%PDF-1.4 fake");
      }
      res.writeHead(200);
      res.end("ok");
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const occurrences: LinkOccurrence[] = [
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "/doc.pdf",
          resolvedUrl: `${server.url}/doc.pdf`,
        },
      ];
      const observations = await checkPortalLinks(
        portal,
        "run-1",
        occurrences,
        makePolicy(),
        makeDeps(),
      );
      expect(observations[0]?.status).toBe("pass");
      expect(observations[0]?.httpStatus).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("tracking parameters are normalized away in normalizedDestinationUrl", async () => {
    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    try {
      const portal = makePortal({ canonicalUrl: `${server.url}/`, hostnames: ["127.0.0.1"] });
      const occurrences: LinkOccurrence[] = [
        {
          portalId: portal.id,
          sourcePageUrl: `${server.url}/`,
          rawHref: "/page?utm_source=news&id=1",
          resolvedUrl: `${server.url}/page?utm_source=news&id=1`,
        },
      ];
      const observations = await checkPortalLinks(
        portal,
        "run-1",
        occurrences,
        makePolicy(),
        makeDeps(),
      );
      expect(observations[0]?.normalizedDestinationUrl).toBe(`${server.url}/page?id=1`);
    } finally {
      await server.close();
    }
  });
});
