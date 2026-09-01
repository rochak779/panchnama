import type {
  Portal,
  PublishedPortalAssessment,
  Severity,
  SuggestedAction,
  TechnicalHealth,
} from "@panchnama/schema";

// `@panchnama/schema` doesn't export a standalone `PortalType` — it's
// declared inline as a `Portal.portalType` field. Derived here rather than
// widened to `string`, so this module still gets exhaustiveness checking.
export type PortalType = Portal["portalType"];

/**
 * Session 13 ("Inventory exploration") — pure, unit-testable filter/sort/
 * URL-state logic for the website inventory, kept out of the React layer
 * for the same reason as Session 12's `overviewSummary.ts`: every rule
 * here is checkable against plain data without rendering anything, and
 * the URL-serialization round trip (`filtersToSearchParams` /
 * `searchParamsFromFilters`) is what makes a filtered view a real,
 * shareable, restorable link (implementation.md section 14 exit
 * criterion for this session).
 */

export const SORT_KEYS = ["name", "health", "severity", "lastChecked"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const ASSESSABLE_VALUES = ["all", "assessable", "not_assessable"] as const;
export type AssessableFilter = (typeof ASSESSABLE_VALUES)[number];

/** "Unspecified" is a real, selectable department filter value — distinct from `undefined` — so a user can isolate the portals implementation.md section 10.3 doesn't have department data for. */
export const UNSPECIFIED_DEPARTMENT = "Unspecified" as const;

export interface InventoryFilters {
  q: string;
  technicalHealth: TechnicalHealth | "all";
  suggestedAction: SuggestedAction | "all";
  severity: Severity | "all";
  department: string | "all";
  portalType: PortalType | "all";
  assessable: AssessableFilter;
  sort: SortKey;
}

export const DEFAULT_FILTERS: InventoryFilters = {
  q: "",
  technicalHealth: "all",
  suggestedAction: "all",
  severity: "all",
  department: "all",
  portalType: "all",
  assessable: "all",
  sort: "name",
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, significant: 1, advisory: 2 };
const HEALTH_RANK: Record<TechnicalHealth, number> = {
  unavailable: 0,
  degraded: 1,
  not_assessable: 2,
  healthy: 3,
};

/** The department shown for filtering/display purposes — `UNSPECIFIED_DEPARTMENT` when the portal has none. */
export function departmentLabel(assessment: PublishedPortalAssessment): string {
  return assessment.portal.department?.trim() || UNSPECIFIED_DEPARTMENT;
}

/** Total reviewed findings across all severities — implementation.md section 10.3's "reviewed finding count" column. */
export function reviewedFindingCount(assessment: PublishedPortalAssessment): number {
  return (
    assessment.criticalFindingCount +
    assessment.significantFindingCount +
    assessment.advisoryFindingCount
  );
}

/** The highest severity with a nonzero count, or `null` if the portal has no findings — implementation.md section 10.3's "highest severity" column. */
export function highestSeverity(assessment: PublishedPortalAssessment): Severity | null {
  if (assessment.criticalFindingCount > 0) return "critical";
  if (assessment.significantFindingCount > 0) return "significant";
  if (assessment.advisoryFindingCount > 0) return "advisory";
  return null;
}

/** Every distinct department label present in the dataset, sorted alphabetically with `UNSPECIFIED_DEPARTMENT` last. */
export function getDepartmentOptions(assessments: PublishedPortalAssessment[]): string[] {
  const set = new Set(assessments.map(departmentLabel));
  const named = [...set].filter((d) => d !== UNSPECIFIED_DEPARTMENT).sort();
  return set.has(UNSPECIFIED_DEPARTMENT) ? [...named, UNSPECIFIED_DEPARTMENT] : named;
}

function matchesSearch(assessment: PublishedPortalAssessment, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  const { portal } = assessment;
  const haystack = [
    portal.name,
    portal.department ?? "",
    portal.canonicalUrl,
    ...portal.hostnames,
    ...portal.alternateUrls,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Applies every filter (search + dropdowns) to an assessment list. Non-mutating. */
export function filterAssessments(
  assessments: PublishedPortalAssessment[],
  filters: InventoryFilters,
): PublishedPortalAssessment[] {
  return assessments.filter((assessment) => {
    if (!matchesSearch(assessment, filters.q)) return false;
    if (filters.technicalHealth !== "all" && assessment.technicalHealth !== filters.technicalHealth)
      return false;
    if (filters.suggestedAction !== "all" && assessment.suggestedAction !== filters.suggestedAction)
      return false;
    if (filters.severity !== "all" && highestSeverity(assessment) !== filters.severity) {
      // A portal counts toward a severity filter if it has *any* finding at
      // that severity, not only as its highest — a critical-severity filter
      // should not hide a portal whose highest severity is critical but
      // that also, trivially, always satisfies this; the branch below
      // covers portals where the filtered severity exists but is not the
      // highest one present.
      const counts: Record<Severity, number> = {
        critical: assessment.criticalFindingCount,
        significant: assessment.significantFindingCount,
        advisory: assessment.advisoryFindingCount,
      };
      if (counts[filters.severity] === 0) return false;
    }
    if (filters.department !== "all" && departmentLabel(assessment) !== filters.department)
      return false;
    if (filters.portalType !== "all" && assessment.portal.portalType !== filters.portalType)
      return false;
    if (filters.assessable === "assessable" && assessment.technicalHealth === "not_assessable")
      return false;
    if (filters.assessable === "not_assessable" && assessment.technicalHealth !== "not_assessable")
      return false;
    return true;
  });
}

/** Sorts a (typically already-filtered) list. Non-mutating — returns a new array. */
export function sortAssessments(
  assessments: PublishedPortalAssessment[],
  sort: SortKey,
): PublishedPortalAssessment[] {
  const copy = [...assessments];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.portal.name.localeCompare(b.portal.name));
    case "health":
      return copy.sort((a, b) => HEALTH_RANK[a.technicalHealth] - HEALTH_RANK[b.technicalHealth]);
    case "severity":
      return copy.sort((a, b) => {
        const aSeverity = highestSeverity(a);
        const bSeverity = highestSeverity(b);
        const aRank = aSeverity ? SEVERITY_RANK[aSeverity] : 3;
        const bRank = bSeverity ? SEVERITY_RANK[bSeverity] : 3;
        return aRank - bRank;
      });
    case "lastChecked":
      return copy.sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt));
    default:
      return copy;
  }
}

const FILTER_PARAM_KEYS: (keyof InventoryFilters)[] = [
  "q",
  "technicalHealth",
  "suggestedAction",
  "severity",
  "department",
  "portalType",
  "assessable",
  "sort",
];

/**
 * Serializes only the filters that differ from `DEFAULT_FILTERS`, so an
 * unfiltered view has an empty query string and a filtered view's URL is
 * exactly as long as it needs to be (implementation.md section 14: "Filters
 * and sorting should be reflected in the URL when feasible").
 */
export function filtersToSearchParams(filters: InventoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_PARAM_KEYS) {
    const value = filters[key];
    if (value !== DEFAULT_FILTERS[key] && value !== "") {
      params.set(key, value);
    }
  }
  return params;
}

const SUGGESTED_ACTION_VALUES: SuggestedAction[] = [
  "maintain",
  "repair",
  "review_consolidation",
  "review_retirement",
  "manual_assessment",
];
const TECHNICAL_HEALTH_VALUES: TechnicalHealth[] = [
  "healthy",
  "degraded",
  "unavailable",
  "not_assessable",
];
const SEVERITY_VALUES: Severity[] = ["critical", "significant", "advisory"];
const PORTAL_TYPE_VALUES: PortalType[] = [
  "information",
  "transactional",
  "directory",
  "mixed",
  "unknown",
];

function readEnum<T extends string>(params: URLSearchParams, key: string, allowed: T[]): T | "all" {
  const raw = params.get(key);
  return raw && (allowed as string[]).includes(raw) ? (raw as T) : "all";
}

/** The inverse of `filtersToSearchParams` — reads whatever is present, falling back to `DEFAULT_FILTERS` for anything missing or invalid. Never throws on a malformed/hand-edited URL. */
export function searchParamsToFilters(params: URLSearchParams): InventoryFilters {
  const sortParam = params.get("sort");
  return {
    q: params.get("q") ?? DEFAULT_FILTERS.q,
    technicalHealth: readEnum(params, "technicalHealth", TECHNICAL_HEALTH_VALUES),
    suggestedAction: readEnum(params, "suggestedAction", SUGGESTED_ACTION_VALUES),
    severity: readEnum(params, "severity", SEVERITY_VALUES),
    department: params.get("department") ?? DEFAULT_FILTERS.department,
    portalType: readEnum(params, "portalType", PORTAL_TYPE_VALUES),
    assessable: (ASSESSABLE_VALUES as readonly string[]).includes(params.get("assessable") ?? "")
      ? (params.get("assessable") as AssessableFilter)
      : DEFAULT_FILTERS.assessable,
    sort:
      sortParam && (SORT_KEYS as readonly string[]).includes(sortParam)
        ? (sortParam as SortKey)
        : DEFAULT_FILTERS.sort,
  };
}
