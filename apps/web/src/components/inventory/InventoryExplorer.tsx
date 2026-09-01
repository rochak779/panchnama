"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublishedPortalAssessment } from "@panchnama/schema";
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
  type InventoryFilters,
} from "@/lib/inventoryFilters";
import { formatAuditDate } from "@/lib/formatDate";
import { EmptyState } from "@/components/EmptyState";
import { SeverityMarker } from "@/components/status/SeverityMarker";
import { StatusBadge } from "@/components/status/StatusBadge";
import { SUGGESTED_ACTION_VISUALS } from "@/components/status/statusTokens";
import styles from "./InventoryExplorer.module.css";

const TECHNICAL_HEALTH_OPTIONS = ["healthy", "degraded", "unavailable", "not_assessable"] as const;
const SEVERITY_OPTIONS = ["critical", "significant", "advisory"] as const;
const SUGGESTED_ACTION_OPTIONS = [
  "maintain",
  "repair",
  "review_consolidation",
  "review_retirement",
  "manual_assessment",
] as const;
const PORTAL_TYPE_OPTIONS = [
  "information",
  "transactional",
  "directory",
  "mixed",
  "unknown",
] as const;

const TECHNICAL_HEALTH_LABELS: Record<(typeof TECHNICAL_HEALTH_OPTIONS)[number], string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unavailable: "Unavailable",
  not_assessable: "Not assessable",
};

const PORTAL_TYPE_LABELS: Record<(typeof PORTAL_TYPE_OPTIONS)[number], string> = {
  information: "Information",
  transactional: "Transactional",
  directory: "Directory",
  mixed: "Mixed",
  unknown: "Unknown",
};

export interface InventoryExplorerProps {
  assessments: PublishedPortalAssessment[];
}

/**
 * Session 13 ("Inventory exploration") — implementation.md section 14 /
 * 10.3. A client component (needs `useSearchParams`/`useRouter` for
 * URL-backed filter state) that receives the full, already-validated
 * assessment list from the server component page and does all
 * search/filter/sort client-side against `src/lib/inventoryFilters.ts` —
 * the dataset is small (a bounded observed estate, not an open web
 * search), so no server round trip is needed per filter change.
 *
 * The URL is the source of truth for filter state: every control reads
 * from `useSearchParams()` (via `searchParamsToFilters`) and every change
 * calls `router.replace` with the new, minimal query string (via
 * `filtersToSearchParams`) rather than keeping filters in local React
 * state that the URL merely mirrors — that asymmetry is what makes a
 * filtered link actually restorable when pasted fresh (this session's
 * exit criterion).
 */
export function InventoryExplorer({ assessments }: InventoryExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => searchParamsToFilters(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(filters.q);

  // Keep the visible search box in sync when the URL changes from outside
  // this input (e.g. Clear all, browser back/forward) without fighting the
  // user's own typing.
  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  function updateFilters(patch: Partial<InventoryFilters>) {
    const next = { ...filters, ...patch };
    const params = filtersToSearchParams(next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // Debounced so every keystroke doesn't trigger a URL update; the URL
  // still ends up holding the final search text once typing settles.
  useEffect(() => {
    if (searchInput === filters.q) return;
    const timeout = setTimeout(() => updateFilters({ q: searchInput }), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const departmentOptions = useMemo(() => getDepartmentOptions(assessments), [assessments]);

  // Search filters the visible list immediately off `searchInput`; every
  // other filter comes straight from the URL. Only the URL write for `q`
  // is debounced (above) — the result list itself never waits on it, so
  // typing feels instant while the shareable URL still settles to the
  // final query text.
  const effectiveFilters = useMemo(() => ({ ...filters, q: searchInput }), [filters, searchInput]);

  const results = useMemo(
    () => sortAssessments(filterAssessments(assessments, effectiveFilters), effectiveFilters.sort),
    [assessments, effectiveFilters],
  );

  const isFiltered = JSON.stringify(effectiveFilters) !== JSON.stringify(DEFAULT_FILTERS);

  function clearAll() {
    setSearchInput("");
    router.replace(pathname, { scroll: false });
  }

  return (
    <div>
      <form
        className={styles.controls}
        role="search"
        aria-label="Filter and search the website inventory"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className={`${styles.field} ${styles.searchField}`}>
          <label htmlFor="inventory-search">Search</label>
          <input
            id="inventory-search"
            type="search"
            placeholder="Website, department, or domain"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-health">Technical health</label>
          <select
            id="filter-health"
            value={filters.technicalHealth}
            onChange={(e) =>
              updateFilters({
                technicalHealth: e.target.value as InventoryFilters["technicalHealth"],
              })
            }
          >
            <option value="all">All</option>
            {TECHNICAL_HEALTH_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {TECHNICAL_HEALTH_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-severity">Severity</label>
          <select
            id="filter-severity"
            value={filters.severity}
            onChange={(e) =>
              updateFilters({ severity: e.target.value as InventoryFilters["severity"] })
            }
          >
            <option value="all">All</option>
            {SEVERITY_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v[0]?.toUpperCase()}
                {v.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-action">Suggested action</label>
          <select
            id="filter-action"
            value={filters.suggestedAction}
            onChange={(e) =>
              updateFilters({
                suggestedAction: e.target.value as InventoryFilters["suggestedAction"],
              })
            }
          >
            <option value="all">All</option>
            {SUGGESTED_ACTION_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {SUGGESTED_ACTION_VISUALS[v].label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-department">Department</label>
          <select
            id="filter-department"
            value={filters.department}
            onChange={(e) => updateFilters({ department: e.target.value })}
          >
            <option value="all">All</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-type">Portal type</label>
          <select
            id="filter-type"
            value={filters.portalType}
            onChange={(e) =>
              updateFilters({ portalType: e.target.value as InventoryFilters["portalType"] })
            }
          >
            <option value="all">All</option>
            {PORTAL_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {PORTAL_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="filter-assessable">Assessment</label>
          <select
            id="filter-assessable"
            value={filters.assessable}
            onChange={(e) =>
              updateFilters({ assessable: e.target.value as InventoryFilters["assessable"] })
            }
          >
            <option value="all">All</option>
            <option value="assessable">Assessable</option>
            <option value="not_assessable">Not assessable</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="sort-by">Sort by</label>
          <select
            id="sort-by"
            value={filters.sort}
            onChange={(e) => updateFilters({ sort: e.target.value as InventoryFilters["sort"] })}
          >
            <option value="name">Name (A–Z)</option>
            <option value="health">Technical health (worst first)</option>
            <option value="severity">Highest severity (most severe first)</option>
            <option value="lastChecked">Last checked (most recent first)</option>
          </select>
        </div>

        {isFiltered ? (
          <button type="button" className={styles.clearButton} onClick={clearAll}>
            Clear all
          </button>
        ) : null}
      </form>

      <p className={styles.resultCount} role="status">
        {results.length} of {assessments.length} portal{assessments.length === 1 ? "" : "s"}
      </p>

      {results.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>Website inventory — the observed Assam government web estate</caption>
            <thead>
              <tr>
                <th scope="col">Website</th>
                <th scope="col">Canonical host</th>
                <th scope="col">Technical health</th>
                <th scope="col">Continuing role</th>
                <th scope="col">Suggested action</th>
                <th scope="col">Highest severity</th>
                <th scope="col">Findings</th>
                <th scope="col">Last checked</th>
                <th scope="col">Coverage note</th>
              </tr>
            </thead>
            <tbody>
              {results.map((assessment) => {
                const severity = highestSeverity(assessment);
                return (
                  <tr key={assessment.portal.id}>
                    <th scope="row">
                      <Link
                        href={`/portals/${assessment.portal.id}`}
                        className={styles.portalName}
                        title={assessment.portal.name}
                      >
                        {assessment.portal.name}
                      </Link>
                      <div className={styles.department} title={departmentLabel(assessment)}>
                        {departmentLabel(assessment)}
                      </div>
                    </th>
                    <td className={styles.host} title={assessment.portal.canonicalUrl}>
                      {assessment.portal.hostnames[0] ?? assessment.portal.canonicalUrl}
                    </td>
                    <td>
                      <StatusBadge status={assessment.technicalHealth} />
                    </td>
                    <td>{assessment.continuingRole.replace(/_/g, " ")}</td>
                    <td>{SUGGESTED_ACTION_VISUALS[assessment.suggestedAction].label}</td>
                    <td>{severity ? <SeverityMarker severity={severity} /> : "—"}</td>
                    <td>{reviewedFindingCount(assessment)}</td>
                    <td className={styles.lastChecked}>
                      {formatAuditDate(assessment.lastCheckedAt)}
                    </td>
                    <td
                      className={styles.coverageNote}
                      title={assessment.crawlCoverage.coverageNote}
                    >
                      {assessment.crawlCoverage.coverageNote}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No portals match these filters"
          description="Try removing a filter or clearing your search."
          action={
            <button type="button" className={styles.clearButton} onClick={clearAll}>
              Clear all filters
            </button>
          }
        />
      )}
    </div>
  );
}
