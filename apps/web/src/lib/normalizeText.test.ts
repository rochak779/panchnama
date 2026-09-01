import { describe, expect, it } from "vitest";
import { normalizeBoundedText } from "./normalizeText";

describe("normalizeBoundedText", () => {
  it("returns null for null, undefined, and empty-after-normalization input", () => {
    expect(normalizeBoundedText(null)).toBeNull();
    expect(normalizeBoundedText(undefined)).toBeNull();
    expect(normalizeBoundedText("   ")).toBeNull();
    expect(normalizeBoundedText("<b>   </b>")).toBeNull();
  });

  it("strips HTML tags but keeps the surrounding text", () => {
    expect(normalizeBoundedText("<script>alert(1)</script>hello")).toBe("alert(1) hello");
    expect(normalizeBoundedText("<b>bold</b> text")).toBe("bold text");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeBoundedText("  hello world  ")).toBe("hello world");
  });

  it("collapses runs of internal whitespace to a single space", () => {
    expect(normalizeBoundedText("hello\n\n  world\tagain")).toBe("hello world again");
  });

  it("leaves already-normalized text unchanged", () => {
    expect(normalizeBoundedText("plain text")).toBe("plain text");
  });
});
