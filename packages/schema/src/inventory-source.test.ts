import { describe, expect, it } from "vitest";
import { inventorySourceSchema } from "./inventory-source.js";
import { validInventorySource } from "./fixtures/valid.js";

describe("inventorySourceSchema", () => {
  it("parses a valid fixture", () => {
    expect(inventorySourceSchema.parse(validInventorySource)).toEqual(validInventorySource);
  });

  it("rejects a non-URL-safe id", () => {
    const result = inventorySourceSchema.safeParse({
      ...validInventorySource,
      id: "src with spaces",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["id"]);
    }
  });

  it("rejects a missing required field", () => {
    const { name: _name, ...rest } = validInventorySource;
    const result = inventorySourceSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "name")).toBe(true);
    }
  });

  it("rejects an unknown field (strict)", () => {
    const result = inventorySourceSchema.safeParse({ ...validInventorySource, extra: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
    }
  });

  it("rejects a missing schemaVersion", () => {
    const { schemaVersion: _sv, ...rest } = validInventorySource;
    const result = inventorySourceSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "schemaVersion")).toBe(true);
    }
  });
});
