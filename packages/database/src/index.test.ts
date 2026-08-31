import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("@panchnama/database", () => {
  it("resolves the package entry point", () => {
    expect(PACKAGE_NAME).toBe("@panchnama/database");
  });
});
