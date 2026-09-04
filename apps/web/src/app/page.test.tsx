// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@/lib/constants";
import { getPublishedPortalAssessments } from "@/lib/publishedRun";
import {
  countByTechnicalHealth,
  countBySeverity,
  countBySuggestedAction,
  directoryMismatchFindings,
  topPriorityFindings,
} from "@/lib/overviewSummary";
import HomePage from "./page";

const HEALTH_LABELS = { healthy: "Healthy", degraded: "Degraded", unavailable: "Unavailable", not_assessable: "Not assessable" } as const;
const SEVERITY_LABELS = { critical: "Critical", significant: "Significant", advisory: "Advisory" } as const;

describe("HomePage / Assam overview (builds from the real published audit run)", () => {
  it("renders just the product name, no explanatory hero copy — that lives on /about", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: PRODUCT_NAME })).toBeInTheDocument();
    expect(screen.queryByText(/case study|case-study/i)).not.toBeInTheDocument();
  });

  it("has a real <main> landmark matching the header's skip link target", () => {
    render(<HomePage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
  });

  it("shows technical-health counts that match the real published assessments", () => {
    render(<HomePage />);
    const assessments = getPublishedPortalAssessments();
    const counts = countByTechnicalHealth(assessments);
    const section = screen.getByRole("heading", { name: "Technical health" }).closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    expect(tiles).toHaveLength(4);
    for (const [status, label] of Object.entries(HEALTH_LABELS)) {
      const tile = tiles.find((t) => t.textContent?.includes(label))!;
      expect(tile).toHaveTextContent(String(counts[status as keyof typeof counts]));
    }
  });

  it("shows severity counts derived from the real published assessments", () => {
    render(<HomePage />);
    const assessments = getPublishedPortalAssessments();
    const counts = countBySeverity(assessments);
    const section = screen
      .getByRole("heading", { name: "Findings by severity" })
      .closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    for (const [severity, label] of Object.entries(SEVERITY_LABELS)) {
      const tile = tiles.find((t) => t.textContent?.includes(label))!;
      expect(tile).toHaveTextContent(String(counts[severity as keyof typeof counts]));
    }
  });

  it("shows one suggested-action tile per possible action, without ever collapsing them into one score", () => {
    render(<HomePage />);
    const assessments = getPublishedPortalAssessments();
    const counts = countBySuggestedAction(assessments);
    const section = screen.getByRole("heading", { name: "Suggested actions" }).closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    expect(tiles).toHaveLength(Object.keys(counts).length);
  });

  it("never renders a composite/single score", () => {
    render(<HomePage />);
    expect(document.body.textContent).not.toMatch(/overall score/i);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("lists priority findings ordered critical first, matching the real derivation", () => {
    render(<HomePage />);
    const assessments = getPublishedPortalAssessments();
    const priority = topPriorityFindings(assessments);
    const section = screen.getByRole("heading", { name: "Priority findings" }).closest("section")!;
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(priority.length);
    if (priority.length > 0) {
      expect(items[0]).toHaveTextContent(priority[0]!.finding.title);
      expect(items[0]).toHaveTextContent(priority[0]!.portalName);
    }
  });

  it("lists real directory mismatch findings separately from priority findings", () => {
    render(<HomePage />);
    const assessments = getPublishedPortalAssessments();
    const mismatches = directoryMismatchFindings(assessments);
    const section = screen
      .getByRole("heading", { name: "Directory mismatch summary" })
      .closest("section")!;
    if (mismatches.length > 0) {
      expect(within(section).getByText(mismatches[0]!.portalName)).toBeInTheDocument();
    } else {
      expect(section.textContent).toMatch(/no directory mismatch/i);
    }
  });

  it("renders no Limitations or Where-to-investigate-next section — that content lives on /methodology now", () => {
    render(<HomePage />);
    expect(screen.queryByRole("heading", { name: "Limitations" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Where to investigate next" }),
    ).not.toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<HomePage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
