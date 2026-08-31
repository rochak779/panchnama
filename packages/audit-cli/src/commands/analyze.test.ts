import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evidenceArtifactSchema, findingSchema, type Portal } from "@panchnama/schema";
import { runCrawlCommand } from "./crawl.js";
import { runAnalyzeCommand } from "./analyze.js";
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

function crawlPolicyYaml(): string {
  return `
schemaVersion: "1.0.0"
boundaries:
  maxPagesPerPortal: 10
  maxDepth: 2
  maxConcurrentRequestsPerHost: 4
  minDelayMsPerHost: 0
  requestTimeoutMs: 1000
  maxAttemptsAvailabilityCritical: 3
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
  globalKillSwitch: false
  disabledDomains: []
  allowedHttpMethods: [GET, HEAD]
`;
}

const CHECKS_YAML = `
schemaVersion: "1.0.0"
checks:
  - ruleId: availability.unavailable.v1
    enabled: true
    parameters:
      spacedAttempts: 3
      minSpacingMinutes: 15
  - ruleId: availability.server-error.v1
    enabled: true
    parameters:
      minRepeatedOccurrences: 2
  - ruleId: availability.not-found.v1
    enabled: true
    parameters:
      minRepeatedOccurrences: 2
  - ruleId: redirect.cross-domain.v1
    enabled: true
    parameters: {}
  - ruleId: availability.automation-blocked.v1
    enabled: true
    parameters: {}
  - ruleId: availability.access-restricted.v1
    enabled: true
    parameters: {}
  - ruleId: broken_link.repeated-failure.v1
    enabled: true
    parameters: {}
  - ruleId: https.certificate-failure.v1
    enabled: true
    parameters: {}
  - ruleId: https.no-tls-upgrade.v1
    enabled: true
    parameters: {}
  - ruleId: freshness.no-signal.v1
    enabled: true
    parameters: {}
  - ruleId: directory_mismatch.unavailable-destination.v1
    enabled: true
    parameters: {}
  - ruleId: directory_mismatch.listed-vs-observed.v1
    enabled: true
    parameters: {}
  - ruleId: directory_mismatch.official-portal-not-listed.v1
    enabled: true
    parameters: {}
  - ruleId: crawl_coverage.summary.v1
    enabled: true
    parameters: {}
`;

function writeConfig(configDir: string): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, "sources.assam.yaml"), SOURCES_YAML, "utf8");
  writeFileSync(join(configDir, "crawl-policy.yaml"), crawlPolicyYaml(), "utf8");
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
  writeFileSync(
    join(runDir, "sources.json"),
    JSON.stringify(
      [
        {
          id: "test-source",
          schemaVersion: "1.0.0",
          name: "Test Source",
          authorityName: "Test Authority",
          url: "https://example.org/directory",
          sourceType: "official_directory",
          retrievedAt: "2026-01-01T00:00:00Z",
        },
      ],
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(inventoryOutDir, "latest"), `${runId}\n`, "utf8");
}

function htmlPage(links: string[] = []): string {
  return `<html><body>${links.map((l) => `<a href="${l}">l</a>`).join("")}</body></html>`;
}

describe("runAnalyzeCommand end-to-end", () => {
  it("produces expected findings for healthy, unreachable, and broken-link fixture portals", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-analyze-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    const analysisOutDir = join(workDir, "analysis");
    const evidenceOutDir = join(workDir, "evidence");
    writeConfig(configDir);

    const dead = await startFixtureServer((_req, res) => {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("service unavailable");
    });
    const good = await startFixtureServer((req, res) => {
      if (req.url === "/dead-service") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage([`${dead.url}/dead-service`]));
    });

    try {
      const portals: Portal[] = [
        makePortal("good-portal", `${good.url}/`, ["127.0.0.1"]),
        makePortal("unreachable-portal", "http://127.0.0.1:59999/", ["127.0.0.1"]),
      ];
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", portals);

      const crawlResult = await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r1",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
        now: () => "2026-09-15T00:00:00Z",
      });
      expect(crawlResult.exitCode).toBe(0);

      const analyzeResult = await runAnalyzeCommand({
        configDir,
        crawlOutDir,
        inventoryOutDir,
        analysisOutDir,
        evidenceOutDir,
        runId: "assam-2026-09-15-r1",
        now: () => "2026-09-15T01:00:00Z",
      });

      expect(analyzeResult.exitCode).toBe(0);

      const outputDir = join(analysisOutDir, "assam-2026-09-15-r1");
      expect(existsSync(outputDir)).toBe(true);

      const findings = readFileSync(join(outputDir, "findings.jsonl"), "utf8")
        .trim()
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l));
      for (const f of findings) {
        expect(findingSchema.safeParse(f).success).toBe(true);
      }

      const evidence = readFileSync(join(outputDir, "evidence-artifacts.jsonl"), "utf8")
        .trim()
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l));
      for (const e of evidence) {
        expect(evidenceArtifactSchema.safeParse(e).success).toBe(true);
      }
      const evidenceIds = new Set(evidence.map((e) => e.id));
      for (const f of findings) {
        for (const ref of f.evidenceRefs) {
          expect(evidenceIds.has(ref)).toBe(true);
        }
      }

      // unreachable-portal: connection failures on all 3 retry attempts
      // should produce a critical availability.unavailable.v1 finding.
      const unavailableFinding = findings.find(
        (f) => f.portalId === "unreachable-portal" && f.ruleId === "availability.unavailable.v1",
      );
      expect(unavailableFinding).toBeDefined();
      expect(unavailableFinding.severity).toBe("critical");
      expect(unavailableFinding.suggestedAction).not.toBe("review_retirement");

      // good-portal: its own entry page is healthy, but it links to a dead
      // service — should produce a broken_link finding.
      const brokenLink = findings.find(
        (f) => f.portalId === "good-portal" && f.ruleId === "broken_link.repeated-failure.v1",
      );
      expect(brokenLink).toBeDefined();
      expect(brokenLink.suggestedAction).toBe("repair");

      // good-portal should NOT have a critical availability finding on its
      // own entry page.
      const goodPortalCritical = findings.find(
        (f) =>
          f.portalId === "good-portal" &&
          f.category === "availability" &&
          f.severity === "critical",
      );
      expect(goodPortalCritical).toBeUndefined();

      const provisionalHealth = JSON.parse(
        readFileSync(join(outputDir, "provisional-technical-health.json"), "utf8"),
      );
      expect(provisionalHealth["unreachable-portal"]).toBe("unavailable");

      // Regression: no finding, for any portal, ever suggests retirement.
      for (const f of findings) {
        expect(f.suggestedAction).not.toBe("review_retirement");
      }
    } finally {
      await good.close();
      await dead.close();
    }
  });

  it("refuses to silently overwrite existing analysis output", async () => {
    workDir = mkdtempSync(join(tmpdir(), "panchnama-analyze-"));
    const configDir = join(workDir, "config");
    const inventoryOutDir = join(workDir, "inventory");
    const crawlOutDir = join(workDir, "crawl");
    const analysisOutDir = join(workDir, "analysis");
    const evidenceOutDir = join(workDir, "evidence");
    writeConfig(configDir);

    const good = await startFixtureServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage());
    });
    try {
      const portals: Portal[] = [makePortal("good-portal", `${good.url}/`, ["127.0.0.1"])];
      writeInventory(inventoryOutDir, "assam-20260101T000000Z", portals);

      await runCrawlCommand({
        configDir,
        inventoryOutDir,
        crawlOutDir,
        repoRoot: workDir,
        runId: "assam-2026-09-15-r1",
        ssrf: { allowLoopbackForTests: true },
        sleepFn: async () => {},
        now: () => "2026-09-15T00:00:00Z",
      });

      const first = await runAnalyzeCommand({
        configDir,
        crawlOutDir,
        inventoryOutDir,
        analysisOutDir,
        evidenceOutDir,
        runId: "assam-2026-09-15-r1",
      });
      expect(first.exitCode).toBe(0);

      const second = await runAnalyzeCommand({
        configDir,
        crawlOutDir,
        inventoryOutDir,
        analysisOutDir,
        evidenceOutDir,
        runId: "assam-2026-09-15-r1",
      });
      expect(second.exitCode).toBe(1);
      expect(second.lines.join(" ")).toContain("refusing to overwrite");
    } finally {
      await good.close();
    }
  });
});
