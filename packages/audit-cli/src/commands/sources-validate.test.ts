import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runSourcesValidate } from "./sources-validate.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/commands -> src -> audit-cli -> packages -> repo root
const repoRoot = join(here, "..", "..", "..", "..");
const realConfigDir = join(repoRoot, "config");

describe("runSourcesValidate", () => {
  it("exits 0 on the real config/ directory and reports digests", () => {
    const result = runSourcesValidate(realConfigDir);
    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toContain("PASSED");
    expect(result.lines.some((l) => l.includes("sourceRegistryDigest"))).toBe(true);
  });

  it("exits non-zero with a clear message on a broken config directory", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "panchnama-sources-validate-broken-"));
    try {
      writeFileSync(join(tmpDir, "sources.assam.yaml"), "not: [valid, yaml: broken");
      const result = runSourcesValidate(tmpDir);
      expect(result.exitCode).toBe(1);
      expect(result.lines[0]).toContain("FAILED");
      expect(result.lines.length).toBeGreaterThan(1);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("exits non-zero on an entirely missing config directory", () => {
    const result = runSourcesValidate(join(tmpdir(), "panchnama-does-not-exist-config-dir"));
    expect(result.exitCode).toBe(1);
  });
});
