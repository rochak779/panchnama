import { describe, expect, it } from "vitest";
import { shouldCaptureBrowserEvidence } from "./evidence.js";

describe("shouldCaptureBrowserEvidence", () => {
  it("captures when the browser fetch succeeded (recovered content from a shell)", () => {
    expect(shouldCaptureBrowserEvidence({ ok: true, hasScreenshot: true })).toBe(true);
  });

  it("captures when the browser fetch was blocked", () => {
    expect(
      shouldCaptureBrowserEvidence({
        ok: false,
        errorCode: "AUTOMATION_BLOCKED",
        hasScreenshot: true,
      }),
    ).toBe(true);
  });

  it("captures when the browser fetch hit an auth wall", () => {
    expect(
      shouldCaptureBrowserEvidence({ ok: false, errorCode: "AUTH_REQUIRED", hasScreenshot: true }),
    ).toBe(true);
  });

  it("does not capture for an ordinary unrelated failure (e.g. a timeout)", () => {
    expect(
      shouldCaptureBrowserEvidence({ ok: false, errorCode: "READ_TIMEOUT", hasScreenshot: true }),
    ).toBe(false);
  });

  it("does not capture when no screenshot was taken, even on a qualifying outcome", () => {
    expect(shouldCaptureBrowserEvidence({ ok: true, hasScreenshot: false })).toBe(false);
  });
});
