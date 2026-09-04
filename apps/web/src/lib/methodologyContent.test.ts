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
  type MethodologyVersionEntry,
  OBSERVED_ESTATE_RULES,
  SEVERITY_CONFIDENCE_RULES,
  sortedVersionHistory,
} from "./methodologyContent";

/**
 * Reads the real published `data/published/current` → `audit-run.json`
 * directly (not through `publishedRun.ts`) so this test fails if the
 * published run changes and `methodologyContent.ts` doesn't — the whole
 * point of the "single source of truth" constraint.
 */
function readPublishedAuditRun(): {
  methodologyVersion: string;
  enabledChecks: string[];
  limitations: string[];
} {
  const publishedDir = join(process.cwd(), "..", "..", "data", "published");
  const runId = readFileSync(join(publishedDir, "current"), "utf8").trim();
  const path = join(publishedDir, runId, "audit-run.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("CURRENT_METHODOLOGY_VERSION", () => {
  it("equals the real published audit-run.json's methodologyVersion", () => {
    const fixture = readPublishedAuditRun();
    expect(CURRENT_METHODOLOGY_VERSION).toBe(fixture.methodologyVersion);
  });

  it("is the latest (and matches the last) entry in METHODOLOGY_VERSION_HISTORY", () => {
    const last = METHODOLOGY_VERSION_HISTORY.at(-1);
    expect(last?.version).toBe(CURRENT_METHODOLOGY_VERSION);
  });
});

describe("sortedVersionHistory", () => {
  it("defaults to METHODOLOGY_VERSION_HISTORY when called with no argument", () => {
    expect(sortedVersionHistory()).toEqual(
      [...METHODOLOGY_VERSION_HISTORY].sort((a, b) => b.date.localeCompare(a.date)),
    );
  });

  it("sorts a synthetic multi-entry array most-recent-first by date", () => {
    // Local test-only entries — the real METHODOLOGY_VERSION_HISTORY constant
    // is left untouched, per the task brief.
    const entries: MethodologyVersionEntry[] = [
      { version: "1.0.0", date: "2026-09-15", summary: "Initial published methodology." },
      { version: "1.1.0", date: "2026-10-01", summary: "Clarified crawl boundaries." },
      { version: "0.9.0", date: "2026-08-01", summary: "Pre-launch draft." },
    ];

    expect(sortedVersionHistory(entries)).toEqual([
      { version: "1.1.0", date: "2026-10-01", summary: "Clarified crawl boundaries." },
      { version: "1.0.0", date: "2026-09-15", summary: "Initial published methodology." },
      { version: "0.9.0", date: "2026-08-01", summary: "Pre-launch draft." },
    ]);

    // Original array is not mutated.
    expect(entries[0]!.version).toBe("1.0.0");
  });
});

describe("CHECK_DEFINITIONS", () => {
  it("has exactly one entry per id in the published run's enabledChecks array, no more, no fewer", () => {
    const fixture = readPublishedAuditRun();
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
  it("exactly equals the published run's limitations array", () => {
    const fixture = readPublishedAuditRun();
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
