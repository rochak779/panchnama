import { DEFAULT_URL_NORMALIZATION_OPTIONS } from "@panchnama/audit-core";
import { describe, expect, it } from "vitest";
import type { PortalCandidateReference } from "./candidate.js";
import { mergeCandidates } from "./merge.js";

const NOW = "2026-08-31T18:15:30.000Z";

function candidate(overrides: Partial<PortalCandidateReference>): PortalCandidateReference {
  return {
    name: "Example Portal",
    url: "https://example.gov.example",
    discoveredFromUrl: "https://source.example",
    discoveryMethod: "listed",
    sourceId: "src-a",
    ...overrides,
  };
}

describe("mergeCandidates", () => {
  it("keeps two candidates on different hosts as separate portals", () => {
    const result = mergeCandidates({
      candidates: [
        candidate({ url: "https://a.example", sourceId: "src-a" }),
        candidate({ url: "https://b.example", sourceId: "src-a" }),
      ],
      sourceTypeById: new Map([["src-a", "official_directory"]]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(result.portals).toHaveLength(2);
  });

  it("merges duplicate hosts observed via different sources into one portal, unioning provenance", () => {
    const result = mergeCandidates({
      candidates: [
        candidate({
          url: "https://shared.example",
          sourceId: "src-a",
          discoveredFromUrl: "https://source-a.example",
        }),
        candidate({
          url: "https://shared.example/",
          sourceId: "src-b",
          discoveredFromUrl: "https://source-b.example",
        }),
      ],
      sourceTypeById: new Map([
        ["src-a", "official_directory"],
        ["src-b", "official_page"],
      ]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(result.portals).toHaveLength(1);
    const portal = result.portals[0]!;
    expect(portal.sourceRefs.sort()).toEqual(["src-a", "src-b"]);
    expect(portal.discovery).toHaveLength(2);
    expect(portal.discovery.map((d) => d.discoveredFromUrl).sort()).toEqual([
      "https://source-a.example",
      "https://source-b.example",
    ]);
  });

  it("does NOT merge http and https variants of the same host without an alias (conservative default)", () => {
    const result = mergeCandidates({
      candidates: [
        candidate({ url: "http://same-host.example/path", sourceId: "src-a" }),
        candidate({ url: "https://same-host.example/path", sourceId: "src-a" }),
      ],
      sourceTypeById: new Map([["src-a", "official_directory"]]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(result.portals).toHaveLength(2);
  });

  it("merges http and https variants when an explicit alias says so", () => {
    const aliasMap = new Map([["http://same-host.example/path", "https://same-host.example/path"]]);
    const result = mergeCandidates({
      candidates: [
        candidate({ url: "http://same-host.example/path", sourceId: "src-a" }),
        candidate({ url: "https://same-host.example/path", sourceId: "src-a" }),
      ],
      sourceTypeById: new Map([["src-a", "official_directory"]]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap,
      nowIso: NOW,
    });
    expect(result.portals).toHaveLength(1);
    expect(result.portals[0]?.canonicalUrl).toBe("https://same-host.example/path");
  });

  it("prefers the name from an officially-sourced candidate over an unverified one", () => {
    const result = mergeCandidates({
      candidates: [
        candidate({
          name: "Unofficial Nickname",
          url: "https://shared.example",
          sourceId: "src-unverified",
        }),
        candidate({
          name: "Official Name",
          url: "https://shared.example",
          sourceId: "src-official",
        }),
      ],
      sourceTypeById: new Map([
        ["src-unverified", "manual_verified"],
        ["src-official", "official_directory"],
      ]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(result.portals).toHaveLength(1);
    expect(result.portals[0]?.name).toBe("Official Name");
  });

  it("falls back to the first-seen name when no merged candidate is officially sourced", () => {
    const result = mergeCandidates({
      candidates: [
        candidate({ name: "First Seen", url: "https://shared.example", sourceId: "src-a" }),
        candidate({ name: "Second Seen", url: "https://shared.example", sourceId: "src-b" }),
      ],
      sourceTypeById: new Map([
        ["src-a", "manual_verified"],
        ["src-b", "manual_verified"],
      ]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(result.portals[0]?.name).toBe("First Seen");
  });

  it("sets officialStatus verified only when at least one member came from an official_directory/official_page source", () => {
    const verified = mergeCandidates({
      candidates: [candidate({ sourceId: "src-a" })],
      sourceTypeById: new Map([["src-a", "official_page"]]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(verified.portals[0]?.officialStatus).toBe("verified");

    const unverified = mergeCandidates({
      candidates: [candidate({ sourceId: "src-b" })],
      sourceTypeById: new Map([["src-b", "manual_verified"]]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(unverified.portals[0]?.officialStatus).toBe("unverified");
  });

  it("never emits 'disputed' automatically", () => {
    const result = mergeCandidates({
      candidates: [
        candidate({ sourceId: "src-a" }),
        candidate({ sourceId: "src-b", name: "Different name" }),
      ],
      sourceTypeById: new Map([
        ["src-a", "official_directory"],
        ["src-b", "manual_verified"],
      ]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    for (const portal of result.portals) {
      expect(portal.officialStatus).not.toBe("disputed");
    }
  });

  it("flags a malformed candidate URL as rejected rather than dropping or including it", () => {
    const result = mergeCandidates({
      candidates: [candidate({ url: "not-a-valid-url", sourceId: "src-a" })],
      sourceTypeById: new Map([["src-a", "official_directory"]]),
      baseUrlById: new Map(),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(result.portals).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("URL normalization failed");
  });

  it("resolves a relative URL against the candidate's source base URL", () => {
    const result = mergeCandidates({
      candidates: [candidate({ url: "/schemes/pension", sourceId: "src-a" })],
      sourceTypeById: new Map([["src-a", "official_page"]]),
      baseUrlById: new Map([["src-a", "https://assam.gov.example"]]),
      normalizationOptions: DEFAULT_URL_NORMALIZATION_OPTIONS,
      aliasMap: new Map(),
      nowIso: NOW,
    });
    expect(result.portals[0]?.canonicalUrl).toBe("https://assam.gov.example/schemes/pension");
  });
});
