import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditRunSchema, pageObservationSchema, type Portal } from "@panchnama/schema";
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
  overrides: { globalKillSwitch?: boolean; disabledDomains?: string[] } = {},
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
  browserFallbackEnabled: false
  perPortalAllowlist: []
  maxBrowserPagesPerPortal: 5
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
  overrides: { globalKillSwitch?: boolean; disabledDomains?: string[] } = {},
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
});
