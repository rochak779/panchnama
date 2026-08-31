import { describe, expect, it } from "vitest";
import { portalSchema } from "./portal.js";
import { validPortalA, validPortalB } from "./fixtures/valid.js";

describe("portalSchema", () => {
  it("parses valid fixtures", () => {
    expect(portalSchema.parse(validPortalA)).toEqual(validPortalA);
    expect(portalSchema.parse(validPortalB)).toEqual(validPortalB);
  });

  it("rejects a geography other than 'assam'", () => {
    const result = portalSchema.safeParse({ ...validPortalA, geography: "delhi" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["geography"]);
    }
  });

  it("rejects an invalid discovery.discoveryMethod", () => {
    const result = portalSchema.safeParse({
      ...validPortalA,
      discovery: [
        {
          discoveredAt: "2026-08-01T06:05:00Z",
          discoveredFromUrl: "https://assam.gov.in/directory",
          discoveryMethod: "search_engine",
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join(".") === "discovery.0.discoveryMethod"),
      ).toBe(true);
    }
  });

  it("rejects an unknown field on a nested discovery entry (strict)", () => {
    const result = portalSchema.safeParse({
      ...validPortalA,
      discovery: [{ ...validPortalA.discovery[0], extra: true }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
    }
  });

  it("rejects a non-URL canonicalUrl", () => {
    const result = portalSchema.safeParse({ ...validPortalA, canonicalUrl: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["canonicalUrl"]);
    }
  });
});
