import { describe, expect, it } from "vitest";
import { decideScope, isDomainDisabled, isHostnameInPortalScope } from "./crawl-scope.js";

describe("isHostnameInPortalScope", () => {
  it("matches exact registered hostnames only", () => {
    expect(isHostnameInPortalScope("assam.gov.in", ["assam.gov.in"])).toBe(true);
    expect(isHostnameInPortalScope("sub.assam.gov.in", ["assam.gov.in"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isHostnameInPortalScope("ASSAM.GOV.IN", ["assam.gov.in"])).toBe(true);
  });
});

describe("isDomainDisabled", () => {
  it("matches exact and subdomain", () => {
    expect(isDomainDisabled("assam.gov.in", ["assam.gov.in"])).toBe(true);
    expect(isDomainDisabled("portal.assam.gov.in", ["assam.gov.in"])).toBe(true);
    expect(isDomainDisabled("other.gov.in", ["assam.gov.in"])).toBe(false);
  });
});

describe("decideScope", () => {
  const base = {
    portalHostnames: ["assam.gov.in"],
    denylistPathPatterns: [],
    routeCategories: [],
    disabledDomains: [],
  };

  it("allows an in-scope URL with no exclusions", () => {
    const result = decideScope({
      ...base,
      normalizedUrl: "https://assam.gov.in/about",
      hostname: "assam.gov.in",
    });
    expect(result.inScope).toBe(true);
  });

  it("rejects an out-of-portal-scope hostname", () => {
    const result = decideScope({
      ...base,
      normalizedUrl: "https://other.gov.in/about",
      hostname: "other.gov.in",
    });
    expect(result.inScope).toBe(false);
  });

  it("rejects a disabled domain", () => {
    const result = decideScope({
      ...base,
      disabledDomains: ["assam.gov.in"],
      normalizedUrl: "https://assam.gov.in/about",
      hostname: "assam.gov.in",
    });
    expect(result.inScope).toBe(false);
    if (!result.inScope) {
      expect(result.reason).toMatch(/disabled/);
    }
  });

  it("rejects a denylisted path pattern", () => {
    const result = decideScope({
      ...base,
      denylistPathPatterns: ["^/private"],
      normalizedUrl: "https://assam.gov.in/private/data",
      hostname: "assam.gov.in",
    });
    expect(result.inScope).toBe(false);
  });

  it("rejects a login route category", () => {
    const result = decideScope({
      ...base,
      routeCategories: ["login"],
      normalizedUrl: "https://assam.gov.in/user/login",
      hostname: "assam.gov.in",
    });
    expect(result.inScope).toBe(false);
  });
});
