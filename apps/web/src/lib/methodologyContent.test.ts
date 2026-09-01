import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECK_DEFINITIONS,
  CRAWL_BOUNDARIES_NOTE,
  CURRENT_METHODOLOGY_VERSION,
  ETHICAL_DISCLAIMER,
  EVIDENCE_RETENTION_NOTE,
  EXPERIENCE_POLICY_SUMMARY,
  HUMAN_REVIEW_PROCESS,
  INVENTORY_SOURCES_NOTE,
  KNOWN_LIMITATIONS,
  METHODOLOGY_VERSION_HISTORY,
  OBSERVED_ESTATE_RULES,
  SEVERITY_CONFIDENCE_RULES,
} from "./methodologyContent";

/**
 * Reads `data/fixtures/audit-run.json` directly (not through
 * `publishedFixtures.ts`) so this test fails if the fixture changes and
 * `methodologyContent.ts` doesn't — the whole point of the "single source
 * of truth" constraint.
 */
function readAuditRunFixture(): {
  methodologyVersion: string;
  enabledChecks: string[];
  limitations: string[];
} {
  const path = join(process.cwd(), "..", "..", "data", "fixtures", "audit-run.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("CURRENT_METHODOLOGY_VERSION", () => {
  it("equals data/fixtures/audit-run.json's methodologyVersion", () => {
    const fixture = readAuditRunFixture();
    expect(CURRENT_METHODOLOGY_VERSION).toBe(fixture.methodologyVersion);
  });

  it("is the latest (and matches the last) entry in METHODOLOGY_VERSION_HISTORY", () => {
    const last = METHODOLOGY_VERSION_HISTORY.at(-1);
    expect(last?.version).toBe(CURRENT_METHODOLOGY_VERSION);
  });
});

describe("CHECK_DEFINITIONS", () => {
  it("has exactly one entry per id in the fixture's enabledChecks array, no more, no fewer", () => {
    const fixture = readAuditRunFixture();
    const definitionIds = CHECK_DEFINITIONS.map((c) => c.id).sort();
    expect(definitionIds).toEqual([...fixture.enabledChecks].sort());
  });

  it("gives every check a non-empty label and description", () => {
    for (const check of CHECK_DEFINITIONS) {
      expect(check.label.length).toBeGreaterThan(0);
      expect(check.description.length).toBeGreaterThan(0);
    }
  });
});

describe("KNOWN_LIMITATIONS", () => {
  it("exactly equals the fixture's limitations array", () => {
    const fixture = readAuditRunFixture();
    expect(KNOWN_LIMITATIONS).toEqual(fixture.limitations);
  });
});

describe("prose exports", () => {
  const proseExports: Record<string, string> = {
    OBSERVED_ESTATE_RULES,
    INVENTORY_SOURCES_NOTE,
    CRAWL_BOUNDARIES_NOTE,
    SEVERITY_CONFIDENCE_RULES,
    HUMAN_REVIEW_PROCESS,
    EVIDENCE_RETENTION_NOTE,
    ETHICAL_DISCLAIMER,
    EXPERIENCE_POLICY_SUMMARY,
  };

  it.each(Object.entries(proseExports))("%s is a non-empty string", (_name, value) => {
    expect(typeof value).toBe("string");
    expect(value.trim().length).toBeGreaterThan(0);
  });
});
