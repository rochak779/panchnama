// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import type { PublishedPortalAssessment } from "@panchnama/schema";
import { OverviewContent } from "./OverviewContent";

describe("OverviewContent (empty/no-findings dataset)", () => {
  it("renders empty states for priority findings and directory mismatches, not a crash or blank section", () => {
    render(<OverviewContent assessments={[]} />);
    expect(screen.getByText("No priority findings")).toBeInTheDocument();
    expect(screen.getByText("No directory mismatches found")).toBeInTheDocument();
  });

  it("shows all-zero counts for an empty dataset rather than omitting the sections", () => {
    render(<OverviewContent assessments={[]} />);
    const section = screen.getByRole("heading", { name: "Technical health" }).closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    expect(tiles).toHaveLength(4);
    tiles.forEach((tile) => expect(tile).toHaveTextContent("0"));
  });

  it("has no detectable accessibility violations on the empty-dataset render", async () => {
    const { container } = render(<OverviewContent assessments={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("OverviewContent (no Limitations / Where to investigate next sections)", () => {
  it("does not render a Limitations or Where-to-investigate-next section — that content lives on /methodology now", () => {
    render(<OverviewContent assessments={[]} />);
    expect(screen.queryByRole("heading", { name: "Limitations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Where to investigate next" })).not.toBeInTheDocument();
  });
});

describe("OverviewContent (many directory mismatches — a real-world-shaped dataset)", () => {
  function makeMismatchAssessment(n: number): PublishedPortalAssessment {
    return {
      schemaVersion: "1.0.0",
      portal: {
        id: `portal-${n}`,
        schemaVersion: "1.0.0",
        name: `Portal ${n}`,
        canonicalUrl: `https://portal-${n}.assam.gov.in`,
        alternateUrls: [],
        hostnames: [`portal-${n}.assam.gov.in`],
        geography: "assam",
        portalType: "information",
        officialStatus: "verified",
        sourceRefs: ["src-1"],
        discovery: [],
        tags: [],
      },
      auditRunId: "assam-2026-09-15-r1",
      technicalHealth: "degraded",
      continuingRole: "not_reviewed",
      suggestedAction: "manual_assessment",
      criticalFindingCount: 0,
      significantFindingCount: 0,
      advisoryFindingCount: 1,
      crawlCoverage: {
        pagesAttempted: 1,
        pagesObserved: 1,
        linksChecked: 0,
        browserFallbackUsed: false,
        coverageNote: "1 page(s) observed.",
      },
      reviewedFindings: [
        {
          schemaVersion: "1.0.0",
          id: `finding-${n}`,
          runId: "assam-2026-09-15-r1",
          portalId: `portal-${n}`,
          ruleId: "directory_mismatch.unavailable-destination.v1",
          category: "directory_mismatch",
          title: "Directory entry points to an unavailable destination",
          summary: `Mismatch for portal ${n}.`,
          severity: "advisory",
          confidence: "medium",
          checkStatus: "fail",
          reviewStatus: "reviewed",
          firstObservedAt: "2026-09-15T00:00:00Z",
          lastObservedAt: "2026-09-15T00:00:00Z",
          evidenceRefs: [],
          affectedUrls: [`https://portal-${n}.assam.gov.in`],
          suggestionRuleId: "suggestion.directory-mismatch.v1",
          suggestedAction: "manual_assessment",
          limitations: [],
        },
      ],
      lastCheckedAt: "2026-09-15T00:00:00Z",
    };
  }

  it("shows only the first 5 directory mismatches, plus a count and link to the full inventory for the rest", () => {
    const assessments = Array.from({ length: 8 }, (_, i) => makeMismatchAssessment(i + 1));
    render(<OverviewContent assessments={assessments} />);
    const section = screen.getByRole("heading", { name: "Directory mismatch summary" }).closest("section")!;
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(within(section).getByText(/\+3 more/)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /full inventory/i })).toHaveAttribute(
      "href",
      "/inventory",
    );
  });

  it("shows no '+more' note when every mismatch already fits on the page", () => {
    const assessments = Array.from({ length: 3 }, (_, i) => makeMismatchAssessment(i + 1));
    render(<OverviewContent assessments={assessments} />);
    const section = screen.getByRole("heading", { name: "Directory mismatch summary" }).closest("section")!;
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).queryByText(/more/)).not.toBeInTheDocument();
  });
});
