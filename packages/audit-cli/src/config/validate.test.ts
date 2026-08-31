import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfigPaths, validateAllConfig } from "./validate.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/config -> src -> audit-cli -> packages -> repo root
const repoRoot = join(here, "..", "..", "..", "..");
const realConfigDir = join(repoRoot, "config");

describe("validateAllConfig against the real repo config/", () => {
  it("passes on config/sources.assam.yaml, crawl-policy.yaml, and checks.yaml", () => {
    const result = validateAllConfig(defaultConfigPaths(realConfigDir));
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.sourceCount).toBeGreaterThan(0);
    expect(result.digests?.sourceRegistryDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.digests?.crawlPolicyDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.digests?.checkConfigDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("validateAllConfig against a broken fixture config directory", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails closed on a missing config directory", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "panchnama-config-missing-"));
    const result = validateAllConfig(defaultConfigPaths(join(tmpDir, "does-not-exist")));
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("fails closed with a clear file/path/reason on duplicate source ids", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "panchnama-config-dup-"));
    writeFileSync(
      join(tmpDir, "sources.assam.yaml"),
      [
        'schemaVersion: "1.0.0"',
        "geography: assam",
        "sources:",
        "  - id: dup-source",
        '    name: "A"',
        '    authorityName: "Gov"',
        '    url: "https://a.example"',
        "    sourceType: official_page",
        "  - id: dup-source",
        '    name: "B"',
        '    authorityName: "Gov"',
        '    url: "https://b.example"',
        "    sourceType: official_page",
        "",
      ].join("\n"),
    );
    writeValidCrawlPolicy(tmpDir);
    writeValidChecks(tmpDir);

    const result = validateAllConfig(defaultConfigPaths(tmpDir));
    expect(result.ok).toBe(false);
    const dupIssue = result.issues.find((i) => i.reason.includes("duplicate source id"));
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.file).toContain("sources.assam.yaml");
  });

  it("fails closed on an invalid geography value", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "panchnama-config-geo-"));
    writeFileSync(
      join(tmpDir, "sources.assam.yaml"),
      [
        'schemaVersion: "1.0.0"',
        "geography: kerala",
        "sources:",
        "  - id: a",
        '    name: "A"',
        '    authorityName: "Gov"',
        '    url: "https://a.example"',
        "    sourceType: official_page",
        "",
      ].join("\n"),
    );
    writeValidCrawlPolicy(tmpDir);
    writeValidChecks(tmpDir);

    const result = validateAllConfig(defaultConfigPaths(tmpDir));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "geography")).toBe(true);
  });

  it("fails closed on malformed YAML", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "panchnama-config-malformed-"));
    writeFileSync(join(tmpDir, "sources.assam.yaml"), "sources: [this is: not valid: yaml");
    writeValidCrawlPolicy(tmpDir);
    writeValidChecks(tmpDir);

    const result = validateAllConfig(defaultConfigPaths(tmpDir));
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("fails closed on a duplicate rule id in checks.yaml", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "panchnama-config-dup-rule-"));
    writeValidSources(tmpDir);
    writeValidCrawlPolicy(tmpDir);
    writeFileSync(
      join(tmpDir, "checks.yaml"),
      [
        'schemaVersion: "1.0.0"',
        "checks:",
        "  - ruleId: availability.unavailable.v1",
        "    enabled: true",
        "  - ruleId: availability.unavailable.v1",
        "    enabled: false",
        "",
      ].join("\n"),
    );

    const result = validateAllConfig(defaultConfigPaths(tmpDir));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.reason.includes("duplicate ruleId"))).toBe(true);
  });

  it("fails closed on a malformed portal override file", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "panchnama-config-portal-"));
    writeValidSources(tmpDir);
    writeValidCrawlPolicy(tmpDir);
    writeValidChecks(tmpDir);
    mkdirSync(join(tmpDir, "portals"));
    writeFileSync(
      join(tmpDir, "portals", "broken.yaml"),
      ['schemaVersion: "1.0.0"', "portalId: some-portal", "overrides: {}", ""].join("\n"),
    );

    const result = validateAllConfig(defaultConfigPaths(tmpDir));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.file.includes("broken.yaml"))).toBe(true);
  });
});

function writeValidSources(dir: string): void {
  writeFileSync(
    join(dir, "sources.assam.yaml"),
    [
      'schemaVersion: "1.0.0"',
      "geography: assam",
      "sources:",
      "  - id: a",
      '    name: "A"',
      '    authorityName: "Gov"',
      '    url: "https://a.example"',
      "    sourceType: official_page",
      "",
    ].join("\n"),
  );
}

function writeValidCrawlPolicy(dir: string): void {
  writeFileSync(
    join(dir, "crawl-policy.yaml"),
    [
      'schemaVersion: "1.0.0"',
      "boundaries:",
      "  maxPagesPerPortal: 40",
      "  maxDepth: 2",
      "  maxConcurrentRequestsPerHost: 2",
      "  minDelayMsPerHost: 750",
      "  requestTimeoutMs: 15000",
      "  maxAttemptsAvailabilityCritical: 3",
      "  maxResponseBodyBytes: 5242880",
      "  maxRedirects: 10",
      "  allowedSchemes: [http, https]",
      "exclusions:",
      "  routeCategories: [login]",
      "  denylistPathPatterns: []",
      "  excludedUrlSchemes: [mailto]",
      "robotsAndIdentification:",
      '  userAgent: "TestBot/0.1"',
      '  contactUrl: "https://example.org/about"',
      "  respectRobotsTxt: true",
      "jsRendering:",
      "  browserFallbackEnabled: false",
      "  perPortalAllowlist: []",
      "  maxBrowserPagesPerPortal: 10",
      "  maxBrowserResourceBytes: 10485760",
      "urlNormalization:",
      "  trailingSlashPolicy: strip",
      "  removeFragments: true",
      "  trackingParameterDenylist: []",
      "  sortRetainedQueryParameters: true",
      "safeOperation:",
      "  globalKillSwitch: false",
      "  disabledDomains: []",
      "  allowedHttpMethods: [GET, HEAD]",
      "",
    ].join("\n"),
  );
}

function writeValidChecks(dir: string): void {
  writeFileSync(
    join(dir, "checks.yaml"),
    [
      'schemaVersion: "1.0.0"',
      "checks:",
      "  - ruleId: availability.unavailable.v1",
      "    enabled: true",
      "",
    ].join("\n"),
  );
}
