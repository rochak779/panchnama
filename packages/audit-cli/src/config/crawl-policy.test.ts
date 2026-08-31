import { describe, expect, it } from "vitest";
import { crawlPolicyConfigSchema } from "./crawl-policy.js";

const validConfig = {
  schemaVersion: "1.0.0",
  boundaries: {
    maxPagesPerPortal: 40,
    maxDepth: 2,
    maxConcurrentRequestsPerHost: 2,
    minDelayMsPerHost: 750,
    requestTimeoutMs: 15000,
    maxAttemptsAvailabilityCritical: 3,
    maxResponseBodyBytes: 5242880,
    maxRedirects: 10,
    allowedSchemes: ["http", "https"],
  },
  exclusions: {
    routeCategories: ["login"],
    denylistPathPatterns: [],
    excludedUrlSchemes: ["mailto"],
  },
  robotsAndIdentification: {
    userAgent: "PanchnamaAuditBot/0.1",
    contactUrl: "https://example.org/about",
    respectRobotsTxt: true,
  },
  jsRendering: {
    browserFallbackEnabled: false,
    perPortalAllowlist: [],
    maxBrowserPagesPerPortal: 10,
    maxBrowserResourceBytes: 10485760,
  },
  urlNormalization: {
    trailingSlashPolicy: "strip" as const,
    removeFragments: true,
    trackingParameterDenylist: ["utm_source"],
    sortRetainedQueryParameters: true,
  },
  safeOperation: {
    globalKillSwitch: false,
    disabledDomains: [],
    allowedHttpMethods: ["GET", "HEAD"] as const,
  },
};

describe("crawlPolicyConfigSchema", () => {
  it("parses a valid config", () => {
    expect(crawlPolicyConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it("rejects a zero maxPagesPerPortal", () => {
    const result = crawlPolicyConfigSchema.safeParse({
      ...validConfig,
      boundaries: { ...validConfig.boundaries, maxPagesPerPortal: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative delay", () => {
    const result = crawlPolicyConfigSchema.safeParse({
      ...validConfig,
      boundaries: { ...validConfig.boundaries, minDelayMsPerHost: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric threshold", () => {
    const result = crawlPolicyConfigSchema.safeParse({
      ...validConfig,
      boundaries: { ...validConfig.boundaries, maxDepth: "two" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxRedirects above the sane ceiling", () => {
    const result = crawlPolicyConfigSchema.safeParse({
      ...validConfig,
      boundaries: { ...validConfig.boundaries, maxRedirects: 500 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a disallowed scheme", () => {
    const result = crawlPolicyConfigSchema.safeParse({
      ...validConfig,
      boundaries: { ...validConfig.boundaries, allowedSchemes: ["ftp"] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) contact URL", () => {
    const result = crawlPolicyConfigSchema.safeParse({
      ...validConfig,
      robotsAndIdentification: {
        ...validConfig.robotsAndIdentification,
        contactUrl: "mailto:audit@example.org",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown top-level field (strict)", () => {
    const result = crawlPolicyConfigSchema.safeParse({ ...validConfig, extra: "nope" });
    expect(result.success).toBe(false);
  });
});
