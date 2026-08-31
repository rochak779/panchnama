import { describe, expect, it } from "vitest";
import { detectEmptyShell } from "./shell-detect.js";

describe("detectEmptyShell", () => {
  it("flags a page with sparse text and few links as a shell", () => {
    const result = detectEmptyShell({
      visibleTextLength: 20,
      linkCount: 0,
      hasAppRootMarker: false,
      htmlByteLength: 500,
    });
    expect(result.isEmptyShell).toBe(true);
  });

  it("flags a small SPA mount-point page as a shell even with a moderate text length", () => {
    const result = detectEmptyShell({
      visibleTextLength: 350,
      linkCount: 10,
      hasAppRootMarker: true,
      htmlByteLength: 2000,
    });
    expect(result.isEmptyShell).toBe(true);
  });

  it("does not flag a normal content-rich page", () => {
    const result = detectEmptyShell({
      visibleTextLength: 3000,
      linkCount: 25,
      hasAppRootMarker: false,
      htmlByteLength: 20000,
    });
    expect(result.isEmptyShell).toBe(false);
  });

  it("does not flag a page with sparse text but many links (e.g. a link directory)", () => {
    const result = detectEmptyShell({
      visibleTextLength: 50,
      linkCount: 40,
      hasAppRootMarker: false,
      htmlByteLength: 4000,
    });
    expect(result.isEmptyShell).toBe(false);
  });

  it("does not flag a page with an app-root marker once real content is present", () => {
    const result = detectEmptyShell({
      visibleTextLength: 800,
      linkCount: 15,
      hasAppRootMarker: true,
      htmlByteLength: 6000,
    });
    expect(result.isEmptyShell).toBe(false);
  });
});
