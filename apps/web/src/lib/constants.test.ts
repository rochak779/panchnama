import { describe, expect, it } from "vitest";
import { PRODUCT_DISCLAIMER, PRODUCT_NAME } from "./constants.js";

describe("web app placeholder constants", () => {
  it("names the product", () => {
    expect(PRODUCT_NAME).toBe("Panchnama");
  });

  it("declares the independence disclaimer", () => {
    expect(PRODUCT_DISCLAIMER).toMatch(/independent project/);
    expect(PRODUCT_DISCLAIMER).not.toMatch(/case.study/i);
  });
});
