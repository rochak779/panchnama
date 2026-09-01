// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
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
  OBSERVED_ESTATE_RULES,
  SEVERITY_CONFIDENCE_RULES,
} from "@/lib/methodologyContent";
import MethodologyPage from "./page";

describe("MethodologyPage (renders real methodologyContent.ts data)", () => {
  it("renders every methodologyContent.ts topic as visible text", () => {
    render(<MethodologyPage />);

    expect(screen.getByText(OBSERVED_ESTATE_RULES)).toBeInTheDocument();
    expect(screen.getByText(INVENTORY_SOURCES_NOTE)).toBeInTheDocument();
    expect(screen.getByText(CRAWL_BOUNDARIES_NOTE)).toBeInTheDocument();
    expect(screen.getByText(SEVERITY_CONFIDENCE_RULES)).toBeInTheDocument();
    expect(screen.getByText(HUMAN_REVIEW_PROCESS)).toBeInTheDocument();
    expect(screen.getByText(EVIDENCE_RETENTION_NOTE)).toBeInTheDocument();
    expect(screen.getByText(ETHICAL_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText(EXPERIENCE_POLICY_SUMMARY)).toBeInTheDocument();

    for (const check of CHECK_DEFINITIONS) {
      expect(document.body.textContent).toContain(check.label);
      expect(screen.getByText(check.id)).toBeInTheDocument();
      expect(screen.getByText(check.description)).toBeInTheDocument();
    }

    for (const limitation of KNOWN_LIMITATIONS) {
      expect(screen.getByText(limitation)).toBeInTheDocument();
    }

    for (const entry of METHODOLOGY_VERSION_HISTORY) {
      expect(screen.getByText(entry.version)).toBeInTheDocument();
      expect(screen.getByText(entry.date)).toBeInTheDocument();
      expect(screen.getByText(entry.summary)).toBeInTheDocument();
    }
  });

  it("shows the version from CURRENT_METHODOLOGY_VERSION, not a hardcoded string", () => {
    render(<MethodologyPage />);
    expect(
      screen.getByText(`Methodology version ${CURRENT_METHODOLOGY_VERSION}`),
    ).toBeInTheDocument();
  });

  it("links to /privacy for the full experience policy", () => {
    render(<MethodologyPage />);
    expect(screen.getByRole("link", { name: /privacy and moderation policy/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("makes the version history table keyboard-focusable with an accessible name", () => {
    render(<MethodologyPage />);
    const region = screen.getByRole("region", { name: "Methodology version history table" });
    expect(region).toHaveAttribute("tabIndex", "0");
  });

  it("has exactly one h2 per section and no skipped heading levels", () => {
    render(<MethodologyPage />);

    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);

    const sections = document.querySelectorAll("section");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of Array.from(sections)) {
      const h2s = within(section as HTMLElement).getAllByRole("heading", { level: 2 });
      expect(h2s).toHaveLength(1);
    }

    // No h3+ anywhere, so no level is skipped between h1 and h2.
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<MethodologyPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
