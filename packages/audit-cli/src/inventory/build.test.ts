import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeInventoryBuild } from "./build.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/inventory -> src -> audit-cli -> packages -> repo root
const repoRoot = join(here, "..", "..", "..", "..");
const realConfigDir = join(repoRoot, "config");
const realSeedDir = join(repoRoot, "data", "seed");

const FIXED_NOW = "2026-08-31T18:15:30.000Z";

describe("computeInventoryBuild", () => {
  it("produces a deterministic, schema-valid inventory from the real seed fixtures + config", () => {
    const result = computeInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.runId).toBe("assam-20260831T181530Z");
    expect(result.inventorySources).toHaveLength(3);

    // Agriculture appears via both the HTML source and the JSON source,
    // with two different trailing-slash forms — should merge into one
    // portal with both sourceRefs preserved.
    const agriculture = result.portals.find(
      (p) => p.canonicalUrl === "https://agriculture.assam.gov.example/",
    );
    expect(agriculture).toBeDefined();
    expect(agriculture?.sourceRefs.sort()).toEqual(["assam-gov-portal", "assam-online-services"]);
    expect(agriculture?.discovery.length).toBeGreaterThanOrEqual(2);
    expect(agriculture?.officialStatus).toBe("verified");

    // Transport Department: aliased legacy RTO domain (from JSON) should
    // merge into the canonical CSV-sourced entry.
    const transport = result.portals.find(
      (p) => p.canonicalUrl === "https://transport.assam.gov.example/",
    );
    expect(transport).toBeDefined();
    expect(transport?.hostnames.sort()).toEqual([
      "rto-assam.gov.example",
      "transport.assam.gov.example",
    ]);
    expect(transport?.alternateUrls).toContain("https://rto-assam.gov.example/");
    expect(transport?.sourceRefs.sort()).toEqual([
      "assam-district-portal-directory",
      "assam-online-services",
    ]);

    // The relative-URL pension link should resolve against the source's
    // configured URL (https://assam.gov.in).
    const pension = result.portals.find((p) => p.name.includes("Pension"));
    expect(pension?.canonicalUrl).toBe("https://assam.gov.in/schemes/pension");

    // Malformed/non-http(s) entries are excluded from portals.json but
    // captured in candidates for the human-reviewable report.
    const rejected = result.candidates.filter((c) => c.rejectedReason !== undefined);
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected.some((c) => c.name.includes("Broken Entry"))).toBe(true);
    expect(rejected.some((c) => c.name.includes("Broken Row"))).toBe(true);
    expect(rejected.some((c) => c.name.includes("broken entry"))).toBe(true); // JSON's javascript: entry

    // No malformed URL leaked into a real Portal record.
    for (const portal of result.portals) {
      expect(() => new URL(portal.canonicalUrl)).not.toThrow();
    }
  });

  it("is deterministic: two builds with the same fixed clock produce identical portals/sources", () => {
    const first = computeInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      now: () => FIXED_NOW,
    });
    const second = computeInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      now: () => FIXED_NOW,
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(first.portals)).toBe(JSON.stringify(second.portals));
      expect(JSON.stringify(first.inventorySources)).toBe(JSON.stringify(second.inventorySources));
    }
  });

  it("every built portal has at least one discovery route and one sourceRef", () => {
    const result = computeInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const portal of result.portals) {
      expect(portal.discovery.length).toBeGreaterThan(0);
      expect(portal.sourceRefs.length).toBeGreaterThan(0);
    }
  });

  it("fails closed when config/sources.assam.yaml is missing", () => {
    const result = computeInventoryBuild({
      configDir: join(repoRoot, "data", "fixtures"),
      seedDir: realSeedDir,
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(false);
  });
});
