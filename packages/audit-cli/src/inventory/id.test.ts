import { describe, expect, it } from "vitest";
import { derivePortalId, deriveInventoryRunId } from "./id.js";

describe("derivePortalId", () => {
  it("is deterministic for the same URL", () => {
    const a = derivePortalId("https://agriculture.assam.gov.example/");
    const b = derivePortalId("https://agriculture.assam.gov.example/");
    expect(a).toBe(b);
  });

  it("is URL-safe (matches the stableId character set)", () => {
    const id = derivePortalId("https://agriculture.assam.gov.example/schemes/pension");
    expect(id).toMatch(/^[A-Za-z0-9._~-]+$/);
  });

  it("produces different IDs for different hosts", () => {
    expect(derivePortalId("https://a.example/")).not.toBe(derivePortalId("https://b.example/"));
  });

  it("produces different IDs for different paths on the same host", () => {
    expect(derivePortalId("https://a.example/one")).not.toBe(
      derivePortalId("https://a.example/two"),
    );
  });
});

describe("deriveInventoryRunId", () => {
  it("produces a stable, URL-safe run ID from an ISO timestamp", () => {
    const runId = deriveInventoryRunId("2026-08-31T18:15:30.000Z");
    expect(runId).toBe("assam-20260831T181530Z");
    expect(runId).toMatch(/^[A-Za-z0-9._~-]+$/);
  });
});
