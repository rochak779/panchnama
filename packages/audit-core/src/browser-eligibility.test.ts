import { describe, expect, it } from "vitest";
import { isBrowserFallbackEligible } from "./browser-eligibility.js";

describe("isBrowserFallbackEligible", () => {
  it("is never eligible when the global switch is off, even if allowlisted", () => {
    const result = isBrowserFallbackEligible({
      globalEnabled: false,
      perPortalAllowlist: ["p1"],
      portalId: "p1",
    });
    expect(result.eligible).toBe(false);
  });

  it("is never eligible when the global switch is off, even with an enabling override", () => {
    const result = isBrowserFallbackEligible({
      globalEnabled: false,
      perPortalAllowlist: [],
      portalId: "p1",
      overrideEnabled: true,
    });
    expect(result.eligible).toBe(false);
  });

  it("is eligible when globally enabled and portal is in the allowlist", () => {
    const result = isBrowserFallbackEligible({
      globalEnabled: true,
      perPortalAllowlist: ["p1"],
      portalId: "p1",
    });
    expect(result.eligible).toBe(true);
  });

  it("is not eligible when globally enabled but portal is not allowlisted and has no override", () => {
    const result = isBrowserFallbackEligible({
      globalEnabled: true,
      perPortalAllowlist: ["other-portal"],
      portalId: "p1",
    });
    expect(result.eligible).toBe(false);
  });

  it("an enabling override makes a non-allowlisted portal eligible", () => {
    const result = isBrowserFallbackEligible({
      globalEnabled: true,
      perPortalAllowlist: [],
      portalId: "p1",
      overrideEnabled: true,
    });
    expect(result.eligible).toBe(true);
  });

  it("a disabling override wins over allowlist membership", () => {
    const result = isBrowserFallbackEligible({
      globalEnabled: true,
      perPortalAllowlist: ["p1"],
      portalId: "p1",
      overrideEnabled: false,
    });
    expect(result.eligible).toBe(false);
  });
});
