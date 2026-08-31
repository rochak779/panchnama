import { describe, expect, it } from "vitest";
import { findDuplicateSourceIds, sourceRegistryConfigSchema } from "./source-registry.js";

const validEntry = {
  id: "example-source",
  name: "Example Source",
  authorityName: "Government of Assam",
  url: "https://example.assam.gov.in",
  sourceType: "official_page" as const,
  enabled: true,
};

const validConfig = {
  schemaVersion: "1.0.0",
  geography: "assam" as const,
  sources: [validEntry],
};

describe("sourceRegistryConfigSchema", () => {
  it("parses a valid config", () => {
    expect(sourceRegistryConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it("defaults enabled to true when omitted", () => {
    const { enabled: _enabled, ...withoutEnabled } = validEntry;
    const result = sourceRegistryConfigSchema.parse({
      ...validConfig,
      sources: [withoutEnabled],
    });
    expect(result.sources[0]?.enabled).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { name: _name, ...rest } = validEntry;
    const result = sourceRegistryConfigSchema.safeParse({ ...validConfig, sources: [rest] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL-safe id", () => {
    const result = sourceRegistryConfigSchema.safeParse({
      ...validConfig,
      sources: [{ ...validEntry, id: "has spaces" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid URL", () => {
    const result = sourceRegistryConfigSchema.safeParse({
      ...validConfig,
      sources: [{ ...validEntry, url: "not-a-url" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) URL scheme", () => {
    const result = sourceRegistryConfigSchema.safeParse({
      ...validConfig,
      sources: [{ ...validEntry, url: "ftp://example.assam.gov.in" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported geography value", () => {
    const result = sourceRegistryConfigSchema.safeParse({ ...validConfig, geography: "kerala" });
    expect(result.success).toBe(false);
  });

  it("rejects a misspelled geography value", () => {
    const result = sourceRegistryConfigSchema.safeParse({ ...validConfig, geography: "Assam" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty sources array", () => {
    const result = sourceRegistryConfigSchema.safeParse({ ...validConfig, sources: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown top-level field (strict)", () => {
    const result = sourceRegistryConfigSchema.safeParse({ ...validConfig, extra: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("findDuplicateSourceIds", () => {
  it("returns an empty array when all ids are unique", () => {
    const config = sourceRegistryConfigSchema.parse(validConfig);
    expect(findDuplicateSourceIds(config)).toEqual([]);
  });

  it("finds a duplicated id", () => {
    const config = sourceRegistryConfigSchema.parse({
      ...validConfig,
      sources: [validEntry, { ...validEntry, name: "Duplicate" }],
    });
    expect(findDuplicateSourceIds(config)).toEqual(["example-source"]);
  });
});
