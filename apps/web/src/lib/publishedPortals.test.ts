import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isKnownPortalId,
  loadPublishedPortalIds,
  setKnownPortalIdsOverrideForTests,
} from "./publishedPortals";

let dataDir: string | undefined;

afterEach(() => {
  setKnownPortalIdsOverrideForTests(undefined);
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
    dataDir = undefined;
  }
});

function makePublishedDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "panchnama-published-"));
  dataDir = dir;
  return dir;
}

describe("loadPublishedPortalIds", () => {
  it("reports unavailable when data/published/current does not exist", () => {
    const dir = makePublishedDir();
    const result = loadPublishedPortalIds(dir);
    expect(result).toEqual({ available: false, ids: new Set() });
  });

  it("reports unavailable when the current pointer names a run with no portal-assessments.json", () => {
    const dir = makePublishedDir();
    mkdirSync(join(dir, "published"), { recursive: true });
    writeFileSync(join(dir, "published", "current"), "run-1");
    const result = loadPublishedPortalIds(dir);
    expect(result.available).toBe(false);
  });

  it("reports unavailable (not throwing) for malformed JSON", () => {
    const dir = makePublishedDir();
    mkdirSync(join(dir, "published", "run-1"), { recursive: true });
    writeFileSync(join(dir, "published", "current"), "run-1");
    writeFileSync(join(dir, "published", "run-1", "portal-assessments.json"), "{not json");
    const result = loadPublishedPortalIds(dir);
    expect(result.available).toBe(false);
  });

  it("returns the real portal ids from a valid published run", () => {
    const dir = makePublishedDir();
    mkdirSync(join(dir, "published", "run-1"), { recursive: true });
    writeFileSync(join(dir, "published", "current"), "run-1");
    writeFileSync(
      join(dir, "published", "run-1", "portal-assessments.json"),
      JSON.stringify([
        { portal: { id: "portal-agri-assam" } },
        { portal: { id: "portal-agri-farmers-welfare" } },
      ]),
    );
    const result = loadPublishedPortalIds(dir);
    expect(result.available).toBe(true);
    expect(result.ids).toEqual(new Set(["portal-agri-assam", "portal-agri-farmers-welfare"]));
  });

  it("lets a test override supply a fixture id set without touching the filesystem", () => {
    setKnownPortalIdsOverrideForTests(["fixture-portal"]);
    const result = loadPublishedPortalIds("/nonexistent/path/that/is/never/read");
    expect(result).toEqual({ available: true, ids: new Set(["fixture-portal"]) });
  });
});

describe("isKnownPortalId", () => {
  it("resolves true for a known id and false for an unknown one", async () => {
    setKnownPortalIdsOverrideForTests(["fixture-portal"]);
    await expect(isKnownPortalId("fixture-portal")).resolves.toBe(true);
    await expect(isKnownPortalId("unknown-portal")).resolves.toBe(false);
  });
});
