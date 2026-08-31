import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("@panchnama/audit-core placeholder", () => {
  it("resolves the package entry point", () => {
    expect(PACKAGE_NAME).toBe("@panchnama/audit-core");
  });
});
