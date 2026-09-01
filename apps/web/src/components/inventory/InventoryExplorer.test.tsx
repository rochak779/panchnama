// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedPortalAssessment } from "@panchnama/schema";
import { InventoryExplorer } from "./InventoryExplorer";

const replace = vi.fn();
let mockSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/inventory",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

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

const dataset = [
  makeAssessment({
    portal: { id: "p-critical", name: "Critical Transport Portal", department: "Transport" },
    technicalHealth: "unavailable",
    suggestedAction: "repair",
    criticalFindingCount: 1,
  }),
  makeAssessment({
    portal: { id: "p-healthy", name: "Healthy Health Portal", department: "Health" },
    technicalHealth: "healthy",
  }),
];

beforeEach(() => {
  replace.mockClear();
  mockSearch = "";
});

describe("InventoryExplorer", () => {
  it("renders every portal with a real result count when unfiltered", () => {
    render(<InventoryExplorer assessments={dataset} />);
    expect(screen.getByText("2 of 2 portals")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Critical Transport Portal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Healthy Health Portal" })).toBeInTheDocument();
  });

  it("restores filter state from the URL (technicalHealth=unavailable)", () => {
    mockSearch = "technicalHealth=unavailable";
    render(<InventoryExplorer assessments={dataset} />);
    expect(screen.getByText("1 of 2 portals")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Critical Transport Portal" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Healthy Health Portal" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Technical health")).toHaveValue("unavailable");
  });

  it("shows a Clear all control only when a filter is active, and it resets the URL", async () => {
    const user = userEvent.setup();
    mockSearch = "technicalHealth=unavailable";
    render(<InventoryExplorer assessments={dataset} />);
    const clear = screen.getByRole("button", { name: "Clear all" });
    await user.click(clear);
    expect(replace).toHaveBeenCalledWith("/inventory", { scroll: false });
  });

  it("does not show Clear all with no active filters", () => {
    render(<InventoryExplorer assessments={dataset} />);
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("updates the URL via keyboard when a select filter changes", async () => {
    const user = userEvent.setup();
    render(<InventoryExplorer assessments={dataset} />);
    const select = screen.getByLabelText("Suggested action");
    select.focus();
    await user.selectOptions(select, "repair");
    expect(replace).toHaveBeenCalledWith("/inventory?suggestedAction=repair", { scroll: false });
  });

  it("debounces the search box: filters visibly update immediately, the URL updates after typing settles", async () => {
    const user = userEvent.setup();
    render(<InventoryExplorer assessments={dataset} />);
    const search = screen.getByLabelText("Search");
    await user.type(search, "transport");
    // The visible list already narrows without waiting for the URL.
    expect(screen.getByText("1 of 2 portals")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(replace).toHaveBeenCalledWith("/inventory?q=transport", { scroll: false });
  });

  it("shows an empty state and a working Clear-all when no portal matches", async () => {
    const user = userEvent.setup();
    mockSearch = "department=Nonexistent";
    render(<InventoryExplorer assessments={dataset} />);
    expect(screen.getByText("No portals match these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(replace).toHaveBeenCalledWith("/inventory", { scroll: false });
  });

  it("renders an accessible, sortable table with real column headers", () => {
    render(<InventoryExplorer assessments={dataset} />);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Website" })).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Technical health" }),
    ).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<InventoryExplorer assessments={dataset} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("handles a large fixture dataset without crashing", () => {
    const large = Array.from({ length: 300 }, (_, i) =>
      makeAssessment({ portal: { id: `p-${i}`, name: `Portal ${i}` } }),
    );
    render(<InventoryExplorer assessments={large} />);
    expect(screen.getByText("300 of 300 portals")).toBeInTheDocument();
  });

  it("truncates and titles unusually long names/departments rather than breaking layout", () => {
    const longName = "A".repeat(300);
    render(
      <InventoryExplorer
        assessments={[
          makeAssessment({ portal: { id: "p-long", name: longName, department: longName } }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: longName })).toHaveAttribute("title", longName);
  });
});
