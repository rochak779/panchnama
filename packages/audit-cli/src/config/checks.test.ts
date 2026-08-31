import { describe, expect, it } from "vitest";
import { checksConfigSchema, findDuplicateRuleIds } from "./checks.js";

const validConfig = {
  schemaVersion: "1.0.0",
  checks: [
    { ruleId: "availability.unavailable.v1", enabled: true, parameters: { spacedAttempts: 3 } },
    { ruleId: "redirect.cross-domain.v1", enabled: true, parameters: {} },
  ],
};

describe("checksConfigSchema", () => {
  it("parses a valid config", () => {
    expect(checksConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it("defaults parameters to {} when omitted", () => {
    const result = checksConfigSchema.parse({
      schemaVersion: "1.0.0",
      checks: [{ ruleId: "availability.unavailable.v1", enabled: true }],
    });
    expect(result.checks[0]?.parameters).toEqual({});
  });

  it("rejects a missing ruleId", () => {
    const result = checksConfigSchema.safeParse({
      schemaVersion: "1.0.0",
      checks: [{ enabled: true }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL-safe ruleId", () => {
    const result = checksConfigSchema.safeParse({
      schemaVersion: "1.0.0",
      checks: [{ ruleId: "has spaces", enabled: true }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty checks array", () => {
    const result = checksConfigSchema.safeParse({ schemaVersion: "1.0.0", checks: [] });
    expect(result.success).toBe(false);
  });
});

describe("findDuplicateRuleIds", () => {
  it("returns an empty array when all ruleIds are unique", () => {
    const config = checksConfigSchema.parse(validConfig);
    expect(findDuplicateRuleIds(config)).toEqual([]);
  });

  it("finds a duplicated ruleId", () => {
    const config = checksConfigSchema.parse({
      schemaVersion: "1.0.0",
      checks: [
        { ruleId: "availability.unavailable.v1", enabled: true },
        { ruleId: "availability.unavailable.v1", enabled: false },
      ],
    });
    expect(findDuplicateRuleIds(config)).toEqual(["availability.unavailable.v1"]);
  });
});
