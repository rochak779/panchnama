// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import type {
  EvidenceArtifact,
  Finding,
  PortalOverlapComparison,
  PublishedPortalAssessment,
} from "@panchnama/schema";
import { PortalDetailContent } from "./PortalDetailContent";

// Task 3 wiring test: PortalDetailContent is only responsible for passing
// the right props to ExperienceSection in the right DOM position — its own
// loading/populated/empty/error behavior is exercised in
// ExperienceSection.test.tsx against the real component. Stubbing it here
// keeps this file's existing tests (including the axe scan) from making a
// real fetch call.
vi.mock("@/components/experience/ExperienceSection", () => ({
  ExperienceSection: ({ portalId, portalName }: { portalId: string; portalName: string }) => (
    <section aria-labelledby="experience-heading">
      <h2 id="experience-heading">Citizen experiences</h2>
      <p>
        Stubbed ExperienceSection for {portalId} / {portalName}
      </p>
    </section>
  ),
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

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-1",
    schemaVersion: "1.0.0",
    runId: "run-1",
    portalId: "portal-x",
    ruleId: "rule.v1",
    category: "availability",
    title: "A finding",
    summary: "A summary of the finding.",
    severity: "advisory",
    confidence: "medium",
    checkStatus: "warning",
    reviewStatus: "reviewed",
    firstObservedAt: "2026-09-15T00:00:00Z",
    lastObservedAt: "2026-09-15T00:00:00Z",
    evidenceRefs: [],
    affectedUrls: [],
    suggestionRuleId: "suggestion.v1",
    suggestedAction: "maintain",
    limitations: [],
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: "evidence-1",
    schemaVersion: "1.0.0",
    runId: "run-1",
    portalId: "portal-x",
    type: "manual_note",
    capturedAt: "2026-09-15T00:00:00Z",
    storagePath: "evidence/e1.txt",
    contentDigest: "sha256:x",
    description: "A description of the evidence.",
    privacyReviewed: true,
    ...overrides,
  };
}

function renderContent(props: Partial<Parameters<typeof PortalDetailContent>[0]> = {}) {
  const assessment = props.assessment ?? makeAssessment();
  return render(
    <PortalDetailContent
      assessment={assessment}
      evidenceArtifacts={props.evidenceArtifacts ?? []}
      overlapComparisons={props.overlapComparisons ?? []}
      allAssessments={props.allAssessments ?? [assessment]}
    />,
  );
}

describe("PortalDetailContent", () => {
  it("shows identity, department, and canonical URL", () => {
    renderContent();
    expect(screen.getByRole("heading", { level: 1, name: "Example Portal" })).toBeInTheDocument();
    expect(screen.getByText("Department of Example")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.assam.gov.in" })).toHaveAttribute(
      "href",
      "https://example.assam.gov.in",
    );
  });

  it("shows technical health, continuing role, and suggested action as distinct fields", () => {
    renderContent({
      assessment: makeAssessment({
        technicalHealth: "degraded",
        continuingRole: "possible_overlap",
        suggestedAction: "repair",
      }),
    });
    const section = screen.getByRole("heading", { name: "Assessment" }).closest("section")!;
    expect(within(section).getByText("Degraded")).toBeInTheDocument();
    expect(within(section).getByText(/Possible overlap/)).toBeInTheDocument();
    expect(within(section).getByText("Repair")).toBeInTheDocument();
  });

  it("renders a portal with many findings, grouped by category", () => {
    const findings = [
      makeFinding({ id: "f-1", category: "availability", severity: "critical" }),
      makeFinding({ id: "f-2", category: "availability", severity: "advisory" }),
      makeFinding({ id: "f-3", category: "https", severity: "significant" }),
      makeFinding({ id: "f-4", category: "broken_link", severity: "advisory" }),
    ];
    renderContent({ assessment: makeAssessment({ reviewedFindings: findings }) });
    const section = screen.getByRole("heading", { name: "Findings" }).closest("section")!;
    expect(within(section).getAllByRole("article")).toHaveLength(4);
    expect(within(section).getByText("availability")).toBeInTheDocument();
    expect(within(section).getByText("https")).toBeInTheDocument();
    expect(within(section).getByText("broken link")).toBeInTheDocument();
  });

  it("shows an empty state for a portal with no findings", () => {
    renderContent({ assessment: makeAssessment({ reviewedFindings: [] }) });
    expect(screen.getByText("No published findings")).toBeInTheDocument();
  });

  it("handles a not-assessable portal, showing its finding and no crash", () => {
    const notAssessableFinding = makeFinding({
      reviewStatus: "not_assessable",
      checkStatus: "not_assessable",
      title: "Blocked by a challenge page",
      limitations: ["Automated crawl blocked."],
    });
    renderContent({
      assessment: makeAssessment({
        technicalHealth: "not_assessable",
        reviewedFindings: [notAssessableFinding],
        crawlCoverage: {
          pagesAttempted: 1,
          pagesObserved: 0,
          linksChecked: 0,
          browserFallbackUsed: false,
          coverageNote: "Blocked by a CAPTCHA challenge.",
        },
      }),
    });
    expect(screen.getByText("Not assessable")).toBeInTheDocument();
    expect(screen.getByText("Blocked by a challenge page")).toBeInTheDocument();
    expect(screen.getByText("Automated crawl blocked.")).toBeInTheDocument();
  });

  it("handles missing optional metadata (no department, no description, no alternate URLs) without crashing", () => {
    renderContent({
      assessment: makeAssessment({
        portal: { department: undefined, description: undefined, alternateUrls: [] },
      }),
    });
    expect(screen.getByText("Not specified")).toBeInTheDocument();
  });

  it("shows multiple evidence sources for one finding", () => {
    const finding = makeFinding({ evidenceRefs: ["e-1", "e-2"] });
    renderContent({
      assessment: makeAssessment({ reviewedFindings: [finding] }),
      evidenceArtifacts: [
        makeArtifact({ id: "e-1", description: "First source." }),
        makeArtifact({ id: "e-2", description: "Second source." }),
      ],
    });
    expect(screen.getByText("First source.")).toBeInTheDocument();
    expect(screen.getByText("Second source.")).toBeInTheDocument();
  });

  it("excludes rejected findings and unreviewed evidence entirely", () => {
    const rejected = makeFinding({
      id: "f-rejected",
      reviewStatus: "rejected",
      title: "Should never appear",
    });
    const reviewed = makeFinding({
      id: "f-reviewed",
      evidenceRefs: ["e-reviewed", "e-unreviewed"],
    });
    renderContent({
      assessment: makeAssessment({ reviewedFindings: [rejected, reviewed] }),
      evidenceArtifacts: [
        makeArtifact({ id: "e-reviewed", description: "Visible evidence.", privacyReviewed: true }),
        makeArtifact({
          id: "e-unreviewed",
          description: "Should never appear.",
          privacyReviewed: false,
        }),
      ],
    });
    expect(screen.queryByText("Should never appear")).not.toBeInTheDocument();
    expect(screen.getByText("Visible evidence.")).toBeInTheDocument();
  });

  it("shows the related overlapping portal and comparison detail when reviewed", () => {
    const otherAssessment = makeAssessment({ portal: { id: "portal-y", name: "Other Portal" } });
    const finding = makeFinding({
      category: "possible_overlap",
      overlapComparisonId: "cmp-1",
    });
    const comparison: PortalOverlapComparison = {
      id: "cmp-1",
      schemaVersion: "1.0.0",
      runId: "run-1",
      portalIdA: "portal-x",
      portalIdB: "portal-y",
      status: "completed",
      reviewedAt: "2026-09-15T00:00:00Z",
      reviewer: "editor-1",
      intendedUserA: "a",
      intendedUserB: "b",
      serviceOrTaskA: "task a",
      serviceOrTaskB: "task b",
      linksOrRedirectsBetween: true,
      materialSimilarities: ["Shares a department"],
      materialDifferences: ["Different transaction stage"],
      conclusion: "possible_overlap",
      uncertaintyNote: "Mandate boundary is unclear.",
      evidenceRefs: ["e-1"],
    };
    const assessment = makeAssessment({ reviewedFindings: [finding] });
    renderContent({
      assessment,
      overlapComparisons: [comparison],
      allAssessments: [assessment, otherAssessment],
    });
    expect(screen.getByRole("link", { name: "Other Portal" })).toHaveAttribute(
      "href",
      "/portals/portal-y",
    );
    expect(screen.getByText("Mandate boundary is unclear.")).toBeInTheDocument();
    expect(screen.getByText("Shares a department")).toBeInTheDocument();
  });

  it("uses safe external-link behavior for the canonical URL and affected URLs", () => {
    const finding = makeFinding({ affectedUrls: ["https://affected.assam.gov.in"] });
    renderContent({ assessment: makeAssessment({ reviewedFindings: [finding] }) });
    const affected = screen.getByRole("link", { name: "https://affected.assam.gov.in" });
    expect(affected).toHaveAttribute("target", "_blank");
    expect(affected).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders long portal name and finding summary text without crashing or truncating", () => {
    const longName = "Assam Integrated Transport and Vehicle Registration Services Portal ".repeat(7).trim();
    const longSummary =
      "This finding describes a recurring availability issue observed across repeated crawl attempts. "
        .repeat(6)
        .trim();
    const finding = makeFinding({ summary: longSummary });
    renderContent({
      assessment: makeAssessment({
        portal: { name: longName },
        reviewedFindings: [finding],
      }),
    });
    expect(screen.getByRole("heading", { level: 1, name: longName })).toBeInTheDocument();
    expect(screen.getByText(longSummary)).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const finding = makeFinding();
    const { container } = renderContent({
      assessment: makeAssessment({ reviewedFindings: [finding] }),
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders ExperienceSection with the portal's id and name, below Findings, with its own landmark heading", () => {
    renderContent({
      assessment: makeAssessment({ portal: { id: "portal-z", name: "Zebra Portal" } }),
    });
    expect(
      screen.getByText("Stubbed ExperienceSection for portal-z / Zebra Portal"),
    ).toBeInTheDocument();

    const experienceHeading = screen.getByRole("heading", { name: "Citizen experiences" });
    expect(experienceHeading.tagName).toBe("H2");

    const findingsHeading = screen.getByRole("heading", { name: "Findings" });
    // DOM order: the findings heading precedes the experience heading.
    expect(
      findingsHeading.compareDocumentPosition(experienceHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Both headings resolve to distinct landmark sections, not one merged
    // container.
    expect(experienceHeading.closest("section")).not.toBe(findingsHeading.closest("section"));
  });
});
