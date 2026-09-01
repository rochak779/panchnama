// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import type { AuditRun, PublishedPortalAssessment } from "@panchnama/schema";
import { OverviewContent } from "./OverviewContent";

const emptyAuditRun: AuditRun = {
  id: "assam-2026-09-15-r1",
  geography: "assam",
  startedAt: "2026-09-15T02:00:00Z",
  completedAt: "2026-09-15T02:05:00Z",
  status: "completed",
  methodologyVersion: "1.0.0",
  schemaVersion: "1.0.0",
  nodeVersion: "22.11.0",
  packageVersionsDigest: "sha256:aaa",
  sourceRegistryDigest: "sha256:bbb",
  crawlPolicyDigest: "sha256:ccc",
  checkConfigDigest: "sha256:ddd",
  enabledChecks: ["availability.unavailable.v1"],
  portalCount: 0,
  portalsSucceeded: 0,
  portalsFailed: 0,
  portalsPartial: 0,
  limitations: [],
};

describe("OverviewContent (empty/no-findings dataset)", () => {
  it("renders empty states for priority findings and directory mismatches, not a crash or blank section", () => {
    render(<OverviewContent auditRun={emptyAuditRun} assessments={[]} />);
    expect(screen.getByText("No priority findings")).toBeInTheDocument();
    expect(screen.getByText("No directory mismatches found")).toBeInTheDocument();
  });

  it("shows all-zero counts for an empty dataset rather than omitting the sections", () => {
    render(<OverviewContent auditRun={emptyAuditRun} assessments={[]} />);
    const section = screen.getByRole("heading", { name: "Technical health" }).closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    expect(tiles).toHaveLength(4);
    tiles.forEach((tile) => expect(tile).toHaveTextContent("0"));
  });

  it("does not show the partial-run callout for a completed run", () => {
    render(<OverviewContent auditRun={emptyAuditRun} assessments={[]} />);
    expect(screen.queryByText(/not every portal could/)).not.toBeInTheDocument();
  });

  it("shows the partial-run callout when the run status is partial", () => {
    render(<OverviewContent auditRun={{ ...emptyAuditRun, status: "partial" }} assessments={[]} />);
    expect(screen.getByText(/not every portal could/)).toBeInTheDocument();
  });

  it("renders no limitations list item when the audit run reports none", () => {
    render(<OverviewContent auditRun={emptyAuditRun} assessments={[]} />);
    const section = screen.getByRole("heading", { name: "Limitations" }).closest("section")!;
    expect(within(section).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("has no detectable accessibility violations on the empty-dataset render", async () => {
    const { container } = render(<OverviewContent auditRun={emptyAuditRun} assessments={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("OverviewContent (partial dataset with one not-assessable portal)", () => {
  const partialAssessment: PublishedPortalAssessment = {
    schemaVersion: "1.0.0",
    portal: {
      id: "portal-x",
      schemaVersion: "1.0.0",
      name: "Example Portal",
      canonicalUrl: "https://example.assam.gov.in",
      alternateUrls: [],
      hostnames: ["example.assam.gov.in"],
      geography: "assam",
      portalType: "information",
      officialStatus: "verified",
      sourceRefs: ["src-1"],
      discovery: [],
      tags: [],
    },
    auditRunId: "assam-2026-09-15-r1",
    technicalHealth: "not_assessable",
    continuingRole: "not_reviewed",
    suggestedAction: "manual_assessment",
    criticalFindingCount: 0,
    significantFindingCount: 0,
    advisoryFindingCount: 0,
    crawlCoverage: {
      pagesAttempted: 1,
      pagesObserved: 0,
      linksChecked: 0,
      browserFallbackUsed: false,
      coverageNote: "Blocked by an authentication wall.",
    },
    reviewedFindings: [],
    lastCheckedAt: "2026-09-15T02:00:00Z",
  };

  it("lists the not-assessable portal with its coverage note", () => {
    render(
      <OverviewContent
        auditRun={{ ...emptyAuditRun, status: "partial", portalCount: 1, portalsPartial: 1 }}
        assessments={[partialAssessment]}
      />,
    );
    const section = screen.getByRole("heading", { name: "Limitations" }).closest("section")!;
    expect(section.textContent).toMatch(/Example Portal/);
    expect(section.textContent).toMatch(/authentication wall/);
  });
});
