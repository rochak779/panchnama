import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { portalSchema, inventorySourceSchema } from "@panchnama/schema";
import { z } from "zod";
import { runInventoryBuild } from "./inventory-build.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/commands -> src -> audit-cli -> packages -> repo root
const repoRoot = join(here, "..", "..", "..", "..");
const realConfigDir = join(repoRoot, "config");
const realSeedDir = join(repoRoot, "data", "seed");

let outDir: string;

afterEach(() => {
  if (outDir) {
    rmSync(outDir, { recursive: true, force: true });
  }
});

describe("runInventoryBuild", () => {
  it("builds a valid, schema-conformant inventory against the real config/seed fixtures", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-build-"));
    const result = runInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      outDir,
      now: () => "2026-08-31T18:15:30.000Z",
    });

    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toContain("PASSED");

    const runDir = join(outDir, "assam-20260831T181530Z");
    const portals = JSON.parse(readFileSync(join(runDir, "portals.json"), "utf8"));
    const sources = JSON.parse(readFileSync(join(runDir, "sources.json"), "utf8"));
    expect(z.array(portalSchema).safeParse(portals).success).toBe(true);
    expect(z.array(inventorySourceSchema).safeParse(sources).success).toBe(true);

    const report = readFileSync(join(runDir, "report.md"), "utf8");
    expect(report).toContain("## Portals");
    expect(report).toContain("## Inventory sources");

    const latest = readFileSync(join(outDir, "latest"), "utf8").trim();
    expect(latest).toBe("assam-20260831T181530Z");
  });

  it("refuses to overwrite an existing run directory", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-build-"));
    const now = () => "2026-08-31T18:15:30.000Z";
    const first = runInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      outDir,
      now,
    });
    expect(first.exitCode).toBe(0);
    const second = runInventoryBuild({
      configDir: realConfigDir,
      seedDir: realSeedDir,
      outDir,
      now,
    });
    expect(second.exitCode).toBe(1);
    expect(second.lines.join(" ")).toContain("refusing to overwrite");
  });

  it("fails closed on an invalid config directory", () => {
    outDir = mkdtempSync(join(tmpdir(), "panchnama-inventory-build-"));
    const result = runInventoryBuild({
      configDir: join(repoRoot, "data", "fixtures"),
      seedDir: realSeedDir,
      outDir,
    });
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toContain("FAILED");
  });
});
