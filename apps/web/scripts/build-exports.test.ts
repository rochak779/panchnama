import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CURRENT_METHODOLOGY_VERSION } from "../src/lib/methodologyContent";
import { getFixturePortalAssessments } from "../src/lib/publishedFixtures";
import { publishableFindings } from "../src/lib/portalDetail";

/**
 * Runs the real `apps/web/scripts/build-exports.ts` (via `tsx`, exactly
 * the way `build:exports`/`build` invoke it) as a child process and checks
 * its real filesystem output — the "download integrity" test
 * implementation.md's test list asks for. Unit-level coverage of the
 * generator's actual logic lives in `../src/lib/exportGenerators.test.ts`;
 * this file only proves the script wiring itself (tsx invocation, file
 * writing, directory creation) produces the 5 real files on disk. Session
 * 16's own exit criteria additionally require running `pnpm --filter
 * @panchnama/web run build` and confirming the files exist afterward —
 * that full-build check is run separately (see the task report) since it
 * also exercises `next build`.
 */

const WEB_ROOT = join(__dirname, "..");
const EXPORTS_DIR = join(WEB_ROOT, "public", "exports");
const FILES = [
  "audit-summary.json",
  "portals.json",
  "findings.json",
  "assam-audit.csv",
  "methodology.json",
];

function runGenerator(): void {
  execFileSync("node_modules/.bin/tsx", ["scripts/build-exports.ts"], {
    cwd: WEB_ROOT,
    stdio: "pipe",
  });
}

describe("build-exports script (real filesystem run)", () => {
  beforeAll(() => {
    runGenerator();
  });

  it("produces all 5 export files", () => {
    for (const file of FILES) {
      expect(existsSync(join(EXPORTS_DIR, file))).toBe(true);
    }
  });

  it("each output parses as valid JSON/CSV", () => {
    for (const file of FILES) {
      const content = readFileSync(join(EXPORTS_DIR, file), "utf8");
      if (file.endsWith(".json")) {
        expect(() => JSON.parse(content)).not.toThrow();
      } else {
        expect(content.split("\r\n").length).toBeGreaterThan(1);
      }
    }
  });

  it("portals.json length equals getFixturePortalAssessments().length", () => {
    const portals = JSON.parse(readFileSync(join(EXPORTS_DIR, "portals.json"), "utf8"));
    expect(portals).toHaveLength(getFixturePortalAssessments().length);
  });

  it("findings.json contains no rejected finding, cross-checked against publishableFindings", () => {
    const findings = JSON.parse(readFileSync(join(EXPORTS_DIR, "findings.json"), "utf8")) as {
      portalId: string;
      findingId: string;
      reviewStatus: string;
    }[];
    expect(findings.some((f) => f.reviewStatus === "rejected")).toBe(false);

    const assessments = getFixturePortalAssessments();
    const expectedCount = assessments.reduce(
      (sum, assessment) => sum + publishableFindings(assessment).length,
      0,
    );
    expect(findings).toHaveLength(expectedCount);
  });

  it("methodology.json's version equals CURRENT_METHODOLOGY_VERSION", () => {
    const methodology = JSON.parse(readFileSync(join(EXPORTS_DIR, "methodology.json"), "utf8"));
    expect(methodology.version).toBe(CURRENT_METHODOLOGY_VERSION);
  });

  it("re-running the generator produces identical portals/findings/audit-summary content, excluding generatedAt", () => {
    const before = {
      summary: readFileSync(join(EXPORTS_DIR, "audit-summary.json"), "utf8"),
      portals: readFileSync(join(EXPORTS_DIR, "portals.json"), "utf8"),
      findings: readFileSync(join(EXPORTS_DIR, "findings.json"), "utf8"),
    };

    runGenerator();

    const after = {
      summary: readFileSync(join(EXPORTS_DIR, "audit-summary.json"), "utf8"),
      portals: readFileSync(join(EXPORTS_DIR, "portals.json"), "utf8"),
      findings: readFileSync(join(EXPORTS_DIR, "findings.json"), "utf8"),
    };

    expect(after.portals).toBe(before.portals);
    expect(after.findings).toBe(before.findings);

    const { generatedAt: _b, ...beforeRest } = JSON.parse(before.summary);
    const { generatedAt: _a, ...afterRest } = JSON.parse(after.summary);
    expect(afterRest).toEqual(beforeRest);
  });

  it("exports directory contains exactly the 5 expected files", () => {
    const entries = readdirSync(EXPORTS_DIR).sort();
    expect(entries).toEqual([...FILES].sort());
  });
});
