import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runInventoryBuild } from "./inventory-build.js";
import { runInventoryValidate } from "./inventory-validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const realConfigDir = join(repoRoot, "config");
const realSeedDir = join(repoRoot, "data", "seed");

let outDir: string;

afterEach(() => {
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

describe("runInventoryValidate", () => {
  it("passes on a real inventory:build output (latest run)", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-validate-"));
    const build = runInventoryBuild({ configDir: realConfigDir, seedDir: realSeedDir, outDir });
    expect(build.exitCode).toBe(0);

    const result = runInventoryValidate({ outDir });
    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toContain("PASSED");
  });

  it("passes when an explicit --run-id is given", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-validate-"));
    runInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      outDir,
      now: () => "2026-01-01T00:00:00.000Z",
    });
    const result = runInventoryValidate({ outDir, runId: "assam-20260101T000000Z" });
    expect(result.exitCode).toBe(0);
  });

  it("fails with no build output found", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-validate-"));
    const result = runInventoryValidate({ outDir });
    expect(result.exitCode).toBe(1);
    expect(result.lines.join(" ")).toContain("no inventory build output found");
  });

  it("fails clearly when a portal is missing sourceRefs (broken fixture output)", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-validate-"));
    const runDir = join(outDir, "assam-broken");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, "portals.json"),
      JSON.stringify([
        {
          id: "broken-portal",
          schemaVersion: "1.0.0",
          name: "Broken Portal",
          canonicalUrl: "https://broken.example",
          alternateUrls: [],
          hostnames: ["broken.example"],
          geography: "assam",
          portalType: "unknown",
          officialStatus: "unverified",
          sourceRefs: [],
          discovery: [
            {
              discoveredAt: "2026-01-01T00:00:00Z",
              discoveredFromUrl: "https://x.example",
              discoveryMethod: "listed",
            },
          ],
          tags: [],
        },
      ]),
    );
    writeFileSync(join(runDir, "sources.json"), JSON.stringify([]));
    writeFileSync(join(outDir, "latest"), "assam-broken\n");

    const result = runInventoryValidate({ outDir });
    expect(result.exitCode).toBe(1);
    expect(result.lines.join(" ")).toContain("no sourceRefs");
  });

  it("fails clearly on a duplicate portal id", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-validate-"));
    const runDir = join(outDir, "assam-dup");
    mkdirSync(runDir, { recursive: true });
    const source = {
      id: "src-a",
      schemaVersion: "1.0.0",
      name: "Source A",
      authorityName: "Authority A",
      url: "https://source-a.example",
      sourceType: "official_page",
      retrievedAt: "2026-01-01T00:00:00Z",
    };
    const portal = {
      id: "dup-id",
      schemaVersion: "1.0.0",
      name: "Portal",
      canonicalUrl: "https://dup.example",
      alternateUrls: [],
      hostnames: ["dup.example"],
      geography: "assam",
      portalType: "unknown",
      officialStatus: "unverified",
      sourceRefs: ["src-a"],
      discovery: [
        {
          discoveredAt: "2026-01-01T00:00:00Z",
          discoveredFromUrl: "https://x.example",
          discoveryMethod: "listed",
        },
      ],
      tags: [],
    };
    writeFileSync(join(runDir, "portals.json"), JSON.stringify([portal, { ...portal }]));
    writeFileSync(join(runDir, "sources.json"), JSON.stringify([source]));
    writeFileSync(join(outDir, "latest"), "assam-dup\n");

    const result = runInventoryValidate({ outDir });
    expect(result.exitCode).toBe(1);
    expect(result.lines.join(" ")).toContain("duplicate Portal id");
  });

  it("fails clearly when portals.json fails schema validation", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-validate-"));
    const runDir = join(outDir, "assam-invalid-schema");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "portals.json"), JSON.stringify([{ id: "x" }]));
    writeFileSync(join(runDir, "sources.json"), JSON.stringify([]));
    writeFileSync(join(outDir, "latest"), "assam-invalid-schema\n");

    const result = runInventoryValidate({ outDir });
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toContain("FAILED");
  });
});
