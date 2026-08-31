import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditRunSchema,
  pageObservationSchema,
  linkObservationSchema,
  evidenceArtifactSchema,
  type Portal,
} from "@panchnama/schema";
import { computeConfigDigest } from "../config/digest.js";
import { parse as parseYaml } from "yaml";
import { runCrawlCommand } from "./crawl.js";
import { startFixtureServer } from "../crawl/testing/fixture-server.js";

let workDir: string;

afterEach(() => {
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
  }
});

const SOURCES_YAML = `
schemaVersion: "1.0.0"
geography: assam
sources:
  - id: test-source
    name: Test Source
    authorityName: Test Authority
    url: "https://example.org/directory"
    sourceType: official_directory
    enabled: true
`;

function crawlPolicyYaml(
  overrides: {
    globalKillSwitch?: boolean;
    disabledDomains?: string[];
    browserFallbackEnabled?: boolean;
    perPortalAllowlist?: string[];
    maxBrowserPagesPerPortal?: number;
  } = {},
): string {
  return `
schemaVersion: "1.0.0"
boundaries:
  maxPagesPerPortal: 10
  maxDepth: 2
  maxConcurrentRequestsPerHost: 4
  minDelayMsPerHost: 0
  requestTimeoutMs: 1000
  maxAttemptsAvailabilityCritical: 1
  maxResponseBodyBytes: 1048576
  maxRedirects: 10
  allowedSchemes: [http, https]
exclusions:
  routeCategories: []
  denylistPathPatterns: []
  excludedUrlSchemes: [mailto, tel, javascript, data]
robotsAndIdentification:
  userAgent: "PanchnamaTestBot/0.1 (+https://example.org/about)"
  contactUrl: "https://example.org/about"
  respectRobotsTxt: true
jsRendering:
  browserFallbackEnabled: ${overrides.browserFallbackEnabled ?? false}
  perPortalAllowlist: [${(overrides.perPortalAllowlist ?? []).map((p) => `"${p}"`).join(", ")}]
  maxBrowserPagesPerPortal: ${overrides.maxBrowserPagesPerPortal ?? 5}
  maxBrowserResourceBytes: 1048576
urlNormalization:
  trailingSlashPolicy: strip
  removeFragments: true
  trackingParameterDenylist: [utm_source]
  sortRetainedQueryParameters: true
safeOperation:
  globalKillSwitch: ${overrides.globalKillSwitch ?? false}
  disabledDomains: [${(overrides.disabledDomains ?? []).map((d) => `"${d}"`).join(", ")}]
  allowedHttpMethods: [GET, HEAD]
`;
}

const CHECKS_YAML = `
schemaVersion: "1.0.0"
checks:
  - ruleId: availability.unavailable.v1
    enabled: true
    parameters: {}
`;

function writeConfig(
  configDir: string,
  overrides: {
    globalKillSwitch?: boolean;
    disabledDomains?: string[];
    browserFallbackEnabled?: boolean;
    perPortalAllowlist?: string[];
    maxBrowserPagesPerPortal?: number;
  } = {},
): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, "sources.assam.yaml"), SOURCES_YAML, "utf8");
  writeFileSync(join(configDir, "crawl-policy.yaml"), crawlPolicyYaml(overrides), "utf8");
  writeFileSync(join(configDir, "checks.yaml"), CHECKS_YAML, "utf8");
}

function makePortal(id: string, canonicalUrl: string, hostnames: string[]): Portal {
  return {
    id,
    schemaVersion: "1.0.0",
    name: `Portal ${id}`,
    canonicalUrl,
    alternateUrls: [],
    hostnames,
    geography: "assam",
    portalType: "information",
    officialStatus: "verified",
    sourceRefs: ["test-source"],
    discovery: [
      {
        discoveredAt: "2026-01-01T00:00:00Z",
        discoveredFromUrl: "https://example.org/",
        discoveryMethod: "manual",
      },
    ],
    tags: [],
  };
}

function writeInventory(inventoryOutDir: string, runId: string, portals: Portal[]): void {
  const runDir = join(inventoryOutDir, runId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, "portals.json"), JSON.stringify(portals, null, 2), "utf8");
  writeFileSync(join(inventoryOutDir, "latest"), `${runId}\n`, "utf8");
}

function htmlPage(links: string[] = []): string {
  return `<html><body>${links.map((l) => `<a href="${l}">l</a>`).join("")}</body></html>`;
}

describe("runCrawlCommand", () => {
  it("crawls a healthy portal and isolates one failing portal without stopping the run", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    writeConfig(configDir);

    const good = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage(["/about"]));
    });
    try {
      const portals: Portal[] = [
        makePortal("good-portal", `${good.url}/`, ["127.0.0.1"]),
        makePortal("unreachable-portal", "http://127.0.0.1:59999/", ["127.0.0.1"]),
      ];
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", portals);

      const result = await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r1",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
        now: () => "2026-09-15T00:00:00Z",
      });

      expect(result.exitCode).toBe(0);
      const outputDir = join(crawlOutDir, "assam-2026-09-15-r1");
      const manifest = JSON.parse(readFileSync(join(outputDir, "manifest.json"), "utf8"));
      expect(auditRunSchema.safeParse(manifest).success).toBe(true);
      expect(manifest.status).toBe("partial");
      expect(manifest.portalsSucceeded).toBe(1);
      expect(manifest.portalsFailed).toBe(1);
      expect(manifest.portalCount).toBe(2);

      const obsLines = readFileSync(join(outputDir, "page-observations.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      for (const obs of obsLines) {
        expect(pageObservationSchema.safeParse(obs).success).toBe(true);
      }
      expect(obsLines.some((o) => o.portalId === "good-portal" && o.httpStatus === 200)).toBe(true);
      expect(
        obsLines.some((o) => o.portalId === "unreachable-portal" && o.errorCode !== undefined),
      ).toBe(true);
    } finally {
      await good.close();
    }
  });

  it("refuses to run when the global kill switch is on", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    writeConfig(configDir, { globalKillSwitch: true });
    writeInventory(inventoryOutDir, "assam-20260101T000000Z", [
      makePortal("p1", "http://127.0.0.1:1234/", ["127.0.0.1"]),
    ]);

    const result = await runCrawlCommand({
      configDir,
      inventoryOutDir,
      crawlOutDir,
      repoRoot: workDir,
      ssrf: { allowLoopbackForTests: true },
    });

    expect(result.exitCode).toBe(1);
    expect(result.lines.join(" ")).toContain("globalKillSwitch");
    expect(existsSync(crawlOutDir)).toBe(false);
  });

  it("skips a portal on a disabled domain, recording the reason", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    writeConfig(configDir, { disabledDomains: ["127.0.0.1"] });

    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage());
    });
    try {
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", [
        makePortal("disabled-portal", `${server.url}/`, ["127.0.0.1"]),
      ]);

      await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r2",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
      });

      expect(server.requestCount).toBe(0);
      const outputDir = join(crawlOutDir, "assam-2026-09-15-r2");
      const skipLog = JSON.parse(readFileSync(join(outputDir, "skip-log.json"), "utf8"));
      expect(skipLog.some((s: { reason: string }) => s.reason.includes("disabled"))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("--dry-run makes zero HTTP requests and writes nothing to disk", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    writeConfig(configDir);

    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage(["/a"]));
    });
    try {
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", [
        makePortal("p1", `${server.url}/`, ["127.0.0.1"]),
      ]);

      const result = await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
        dryRun: true,
      });

      expect(result.exitCode).toBe(0);
      expect(server.requestCount).toBe(0);
      expect(existsSync(crawlOutDir)).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("refuses to overwrite an existing run directory", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    writeConfig(configDir);

    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage());
    });
    try {
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", [
        makePortal("p1", `${server.url}/`, ["127.0.0.1"]),
      ]);
      const params = {
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r1",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
      };
      const first = await runCrawlCommand(params);
      expect(first.exitCode).toBe(0);
      const second = await runCrawlCommand(params);
      expect(second.exitCode).toBe(1);
      expect(second.lines.join(" ")).toContain("refusing to overwrite");
    } finally {
      await server.close();
    }
  });

  it("manifest config digests match Session 2's digest function for the same config content", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    writeConfig(configDir);

    const server = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage());
    });
    try {
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", [
        makePortal("p1", `${server.url}/`, ["127.0.0.1"]),
      ]);
      const result = await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r1",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
      });
      expect(result.exitCode).toBe(0);
      const manifest = JSON.parse(
        readFileSync(join(crawlOutDir, "assam-2026-09-15-r1", "manifest.json"), "utf8"),
      );
      const crawlPolicyParsed = parseYaml(
        readFileSync(join(configDir, "crawl-policy.yaml"), "utf8"),
      );
      expect(manifest.crawlPolicyDigest).toBe(computeConfigDigest(crawlPolicyParsed));
    } finally {
      await server.close();
    }
  });

  it("end-to-end: extracts pages and checks links, producing schema-valid PageObservations and LinkObservations with full traceability", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    writeConfig(configDir);

    const external = await startFixtureServer((_req, res) => {
      res.writeHead(503);
      res.end();
    });
    // Deliberately addressed as "localhost" rather than "127.0.0.1" (the
    // fixture server always binds 127.0.0.1) so relationship classification
    // (hostname-based) actually sees it as a different, non-portal
    // hostname — a real external link, not just a different port on the
    // portal's own registered hostname.
    const externalUrl = external.url.replace("127.0.0.1", "localhost");
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(
          `<html lang="en"><head><title>Home</title><link rel="canonical" href="/"></head>
           <body>
             <a href="/broken-internal">Broken internal</a>
             <a href="${externalUrl}/">Broken external</a>
             <a href="mailto:info@example.org">Email us</a>
             <a href="/about">About</a>
           </body></html>`,
        );
      }
      if (req.url === "/about") {
        res.writeHead(200, { "Content-Type": "text/html" });
        // Same broken-internal destination linked again from a second page,
        // with different anchor text — must dedup the check, not the record.
        return res.end(`<html><body><a href="/broken-internal">Also broken</a></body></html>`);
      }
      if (req.url === "/broken-internal") {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200);
      res.end("ok");
    });
    try {
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", [
        makePortal("multi-page-portal", `${server.url}/`, ["127.0.0.1"]),
      ]);

      const result = await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r3",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
        now: () => "2026-09-15T00:00:00Z",
      });

      expect(result.exitCode).toBe(0);
      const outputDir = join(crawlOutDir, "assam-2026-09-15-r3");

      const pageObs = readFileSync(join(outputDir, "page-observations.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      for (const obs of pageObs) {
        expect(pageObservationSchema.safeParse(obs).success).toBe(true);
      }
      const home = pageObs.find((o) => o.requestedUrl === `${server.url}/`);
      expect(home?.title).toBe("Home");
      expect(home?.canonical).toBe(`${server.url}/`);
      expect(home?.language).toBe("en");

      const linkObs = readFileSync(join(outputDir, "link-observations.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      for (const obs of linkObs) {
        expect(linkObservationSchema.safeParse(obs).success).toBe(true);
      }

      // Broken internal link: two occurrences (from / and /about), both
      // recorded, sharing one check result — full traceability.
      const brokenInternal = linkObs.filter((o) =>
        o.normalizedDestinationUrl.endsWith("/broken-internal"),
      );
      expect(brokenInternal).toHaveLength(2);
      expect(brokenInternal.every((o) => o.status === "fail")).toBe(true);
      expect(brokenInternal.every((o) => o.httpStatus === 404)).toBe(true);
      expect(brokenInternal.every((o) => o.relationship === "internal")).toBe(true);
      expect(new Set(brokenInternal.map((o) => o.sourcePageUrl))).toEqual(
        new Set([`${server.url}/`, `${server.url}/about`]),
      );

      // Broken external link.
      const brokenExternal = linkObs.find((o) => o.normalizedDestinationUrl === `${externalUrl}/`);
      expect(brokenExternal?.status).toBe("fail");
      expect(brokenExternal?.relationship).toBe("external");
      expect(brokenExternal?.errorCode).toBe("HTTP_SERVER_ERROR");

      // Excluded mailto link — recorded, never fetched.
      const mailLink = linkObs.find((o) => o.destinationUrl.startsWith("mailto:"));
      expect(mailLink?.status).toBe("not_applicable");
      expect(mailLink?.attempts).toBe(0);

      // Working internal link.
      const aboutLink = linkObs.find((o) => o.normalizedDestinationUrl === `${server.url}/about`);
      expect(aboutLink?.status).toBe("pass");
    } finally {
      await server.close();
      await external.close();
    }
  });

  it("run-level wiring: a portal-override file enables browser fallback and evidence-artifacts.jsonl is written and schema-valid", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-crawl-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    const evidenceOutDir = join(workDir, "evidence");
    // Globally enabled but with an EMPTY allowlist — only the per-portal
    // override file below should make "shell-portal" eligible.
    writeConfig(configDir, { browserFallbackEnabled: true, perPortalAllowlist: [] });
    mkdirSync(join(configDir, "portals"), { recursive: true });
    writeFileSync(
      join(configDir, "portals", "shell-portal.yaml"),
      `schemaVersion: "1.0.0"\nportalId: shell-portal\noverrides:\n  browserFallbackEnabled: true\n`,
      "utf8",
    );

    let homeHits = 0;
    const server = await startFixtureServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      if (req.url === "/") {
        homeHits += 1;
        if (homeHits === 1) {
          // Empty client-rendered shell, on the plain HTTP fetch.
          res.end(
            `<html><head><title>Loading</title></head><body><div id="root"></div></body></html>`,
          );
          return;
        }
      }
      // What browser rendering recovers (the second, browser-mode fetch of
      // "/", or any other in-scope page).
      res.end(
        `<html lang="en"><head><title>Real Portal</title></head><body><h1>Welcome</h1><p>${"Real content. ".repeat(30)}</p><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a></body></html>`,
      );
    });
    try {
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", [
        makePortal("shell-portal", `${server.url}/`, ["127.0.0.1"]),
      ]);

      const result = await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        evidenceOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r6",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
        now: () => "2026-09-15T00:00:00Z",
      });

      expect(result.exitCode).toBe(0);
      const outputDir = join(crawlOutDir, "assam-2026-09-15-r6");

      const pageObs = readFileSync(join(outputDir, "page-observations.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      expect(pageObs.some((o) => o.fetchMode === "browser" && o.title === "Real Portal")).toBe(
        true,
      );

      const evidencePath = join(outputDir, "evidence-artifacts.jsonl");
      expect(existsSync(evidencePath)).toBe(true);
      const evidenceLines = readFileSync(evidencePath, "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      expect(evidenceLines.length).toBeGreaterThan(0);
      for (const artifact of evidenceLines) {
        expect(evidenceArtifactSchema.safeParse(artifact).success).toBe(true);
        expect(existsSync(join(evidenceOutDir, artifact.storagePath))).toBe(true);
      }
    } finally {
      await server.close();
    }
  }, 20000);
});
