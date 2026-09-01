import type { PublishedPortalAssessment } from "@panchnama/schema";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  departmentLabel,
  filterAssessments,
  filtersToSearchParams,
  getDepartmentOptions,
  highestSeverity,
  reviewedFindingCount,
  searchParamsToFilters,
  sortAssessments,
  UNSPECIFIED_DEPARTMENT,
  type InventoryFilters,
} from "./inventoryFilters";

function makeAssessment(
  overrides: Omit<Partial<PublishedPortalAssessment>, "portal"> & {
    portal?: Partial<PublishedPortalAssessment["portal"]>;
  } = {},
): PublishedPortalAssessment {
  const { portal: portalOverrides, ...rest } = overrides;
  return {
    schemaVersion: "1.0.0",
    portal: {
      id: "portal-x",
      schemaVersion: "1.0.0",
      name: "Example Portal",
      canonicalUrl: "https://example.assam.gov.in",
      alternateUrls: [],
      hostnames: ["example.assam.gov.in"],
      department: "Department of Example",
      geography: "assam",
      portalType: "information",
      officialStatus: "verified",
      sourceRefs: ["src-1"],
      discovery: [],
      tags: [],
      ...portalOverrides,
    },
    auditRunId: "assam-2026-09-15-r1",
    technicalHealth: "healthy",
    continuingRole: "distinct",
    suggestedAction: "maintain",
    criticalFindingCount: 0,
    significantFindingCount: 0,
    advisoryFindingCount: 0,
    crawlCoverage: {
      pagesAttempted: 1,
      pagesObserved: 1,
      linksChecked: 1,
      browserFallbackUsed: false,
      coverageNote: "ok",
    },
    reviewedFindings: [],
    lastCheckedAt: "2026-09-15T02:00:00Z",
    ...rest,
  };
}

describe("departmentLabel / getDepartmentOptions", () => {
  it("falls back to the unspecified label when department is missing", () => {
    const a = makeAssessment({ portal: { department: undefined } });
    expect(departmentLabel(a)).toBe(UNSPECIFIED_DEPARTMENT);
  });

  it("lists distinct departments alphabetically with unspecified last", () => {
    const options = getDepartmentOptions([
      makeAssessment({ portal: { department: "Zeta" } }),
      makeAssessment({ portal: { department: "Alpha" } }),
      makeAssessment({ portal: { department: undefined } }),
    ]);
    expect(options).toEqual(["Alpha", "Zeta", UNSPECIFIED_DEPARTMENT]);
  });
});

describe("highestSeverity / reviewedFindingCount", () => {
  it("returns null when there are no findings", () => {
    expect(highestSeverity(makeAssessment())).toBeNull();
    expect(reviewedFindingCount(makeAssessment())).toBe(0);
  });

  it("returns the highest severity present", () => {
    const a = makeAssessment({ significantFindingCount: 1, advisoryFindingCount: 2 });
    expect(highestSeverity(a)).toBe("significant");
    expect(reviewedFindingCount(a)).toBe(3);
  });
});

describe("filterAssessments", () => {
  const critical = makeAssessment({
    portal: { id: "p-critical", name: "Critical Portal", department: "Transport" },
    technicalHealth: "unavailable",
    suggestedAction: "repair",
    criticalFindingCount: 1,
  });
  const healthy = makeAssessment({
    portal: { id: "p-healthy", name: "Healthy Portal", department: "Health" },
    technicalHealth: "healthy",
    suggestedAction: "maintain",
  });
  const dataset = [critical, healthy];

  it("isolates unavailable portals (technical health filter)", () => {
    const result = filterAssessments(dataset, {
      ...DEFAULT_FILTERS,
      technicalHealth: "unavailable",
    });
    expect(result.map((a) => a.portal.id)).toEqual(["p-critical"]);
  });

  it("isolates repair candidates (suggested action filter)", () => {
    const result = filterAssessments(dataset, { ...DEFAULT_FILTERS, suggestedAction: "repair" });
    expect(result.map((a) => a.portal.id)).toEqual(["p-critical"]);
  });

  it("isolates critical findings (severity filter)", () => {
    const result = filterAssessments(dataset, { ...DEFAULT_FILTERS, severity: "critical" });
    expect(result.map((a) => a.portal.id)).toEqual(["p-critical"]);
  });

  it("filters by department", () => {
    const result = filterAssessments(dataset, { ...DEFAULT_FILTERS, department: "Health" });
    expect(result.map((a) => a.portal.id)).toEqual(["p-healthy"]);
  });

  it("searches by portal name (case-insensitive)", () => {
    const result = filterAssessments(dataset, { ...DEFAULT_FILTERS, q: "healthy" });
    expect(result.map((a) => a.portal.id)).toEqual(["p-healthy"]);
  });

  it("searches by hostname/domain", () => {
    const withHost = makeAssessment({
      portal: { id: "p-host", name: "Host Match", hostnames: ["special-host.assam.gov.in"] },
    });
    const result = filterAssessments([...dataset, withHost], {
      ...DEFAULT_FILTERS,
      q: "special-host",
    });
    expect(result.map((a) => a.portal.id)).toEqual(["p-host"]);
  });

  it("combines multiple filters (AND semantics)", () => {
    const result = filterAssessments(dataset, {
      ...DEFAULT_FILTERS,
      technicalHealth: "unavailable",
      department: "Transport",
    });
    expect(result.map((a) => a.portal.id)).toEqual(["p-critical"]);
    const noMatch = filterAssessments(dataset, {
      ...DEFAULT_FILTERS,
      technicalHealth: "unavailable",
      department: "Health",
    });
    expect(noMatch).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterAssessments(dataset, { ...DEFAULT_FILTERS, q: "no such portal" });
    expect(result).toEqual([]);
  });

  it("filters by assessment availability", () => {
    const notAssessable = makeAssessment({
      portal: { id: "p-na" },
      technicalHealth: "not_assessable",
    });
    const result = filterAssessments([...dataset, notAssessable], {
      ...DEFAULT_FILTERS,
      assessable: "not_assessable",
    });
    expect(result.map((a) => a.portal.id)).toEqual(["p-na"]);

    const onlyAssessable = filterAssessments([...dataset, notAssessable], {
      ...DEFAULT_FILTERS,
      assessable: "assessable",
    });
    expect(onlyAssessable.map((a) => a.portal.id).sort()).toEqual(["p-critical", "p-healthy"]);
  });

  it("handles a large fixture dataset without error", () => {
    const large = Array.from({ length: 500 }, (_, i) =>
      makeAssessment({
        portal: { id: `p-${i}`, name: `Portal ${i}`, department: i % 2 === 0 ? "Even" : "Odd" },
      }),
    );
    const result = filterAssessments(large, { ...DEFAULT_FILTERS, department: "Even" });
    expect(result).toHaveLength(250);
  });

  it("handles unusually long search/department values without throwing", () => {
    const longName = "A".repeat(500);
    const portal = makeAssessment({
      portal: { id: "p-long", name: longName, department: longName },
    });
    expect(() =>
      filterAssessments([portal], { ...DEFAULT_FILTERS, q: "aaaa", department: longName }),
    ).not.toThrow();
  });
});

describe("sortAssessments", () => {
  const a = makeAssessment({
    portal: { id: "b", name: "B Portal" },
    technicalHealth: "healthy",
    criticalFindingCount: 0,
    lastCheckedAt: "2026-09-14T00:00:00Z",
  });
  const b = makeAssessment({
    portal: { id: "a", name: "A Portal" },
    technicalHealth: "unavailable",
    criticalFindingCount: 1,
    lastCheckedAt: "2026-09-15T00:00:00Z",
  });
  const dataset = [a, b];

  it("sorts by name", () => {
    expect(sortAssessments(dataset, "name").map((x) => x.portal.id)).toEqual(["a", "b"]);
  });

  it("sorts by technical health, worst first", () => {
    expect(sortAssessments(dataset, "health").map((x) => x.portal.id)).toEqual(["a", "b"]);
  });

  it("sorts by highest severity, most severe first", () => {
    expect(sortAssessments(dataset, "severity").map((x) => x.portal.id)).toEqual(["a", "b"]);
  });

  it("sorts by last checked, most recent first", () => {
    expect(sortAssessments(dataset, "lastChecked").map((x) => x.portal.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const original = [...dataset];
    sortAssessments(dataset, "name");
    expect(dataset).toEqual(original);
  });
});

describe("filtersToSearchParams / searchParamsToFilters (URL round trip)", () => {
  it("produces an empty query string for default filters", () => {
    expect(filtersToSearchParams(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("round-trips a non-default filter set through the URL", () => {
    const filters: InventoryFilters = {
      ...DEFAULT_FILTERS,
      q: "agri",
      technicalHealth: "unavailable",
      suggestedAction: "repair",
      severity: "critical",
      department: "Transport",
      portalType: "transactional",
      assessable: "assessable",
      sort: "health",
    };
    const params = filtersToSearchParams(filters);
    const restored = searchParamsToFilters(params);
    expect(restored).toEqual(filters);
  });

  it("falls back to defaults for missing or malformed query values", () => {
    const params = new URLSearchParams("technicalHealth=not-a-real-value&sort=nonsense");
    const restored = searchParamsToFilters(params);
    expect(restored.technicalHealth).toBe("all");
    expect(restored.sort).toBe("name");
  });

  it("never throws on an arbitrary hand-edited URL", () => {
    const params = new URLSearchParams("q=%F0%9F%98%80&foo=bar&severity=");
    expect(() => searchParamsToFilters(params)).not.toThrow();
  });
});
