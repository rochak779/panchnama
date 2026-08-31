import { describe, expect, it } from "vitest";
import { portalOverrideConfigSchema } from "./portal-override.js";

const validConfig = {
  schemaVersion: "1.0.0",
  portalId: "example-portal",
  overrides: { maxPagesPerPortal: 20, browserFallbackEnabled: true },
};

describe("portalOverrideConfigSchema", () => {
  it("parses a valid override", () => {
    expect(portalOverrideConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it("rejects a missing portalId", () => {
    const { portalId: _portalId, ...rest } = validConfig;
    const result = portalOverrideConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an empty overrides object (conflicting/malformed: nothing to override)", () => {
    const result = portalOverrideConfigSchema.safeParse({ ...validConfig, overrides: {} });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown override key (strict)", () => {
    const result = portalOverrideConfigSchema.safeParse({
      ...validConfig,
      overrides: { ...validConfig.overrides, notARealSetting: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative maxPagesPerPortal override", () => {
    const result = portalOverrideConfigSchema.safeParse({
      ...validConfig,
      overrides: { maxPagesPerPortal: -5 },
    });
    expect(result.success).toBe(false);
  });
});
