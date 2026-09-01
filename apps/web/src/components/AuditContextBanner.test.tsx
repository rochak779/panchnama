// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { AuditContextBanner } from "./AuditContextBanner";

const BASE_RUN = {
  startedAt: "2026-09-15T02:00:00Z",
  completedAt: "2026-09-15T04:30:00Z",
  status: "partial" as const,
  portalCount: 2,
};

describe("AuditContextBanner", () => {
  it("states the audit completion date in plain English", () => {
    render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(screen.getByText("15 September 2026")).toBeInTheDocument();
  });

  it("falls back to the start date, labeled, when the run has not completed", () => {
    render(
      <AuditContextBanner auditRun={{ ...BASE_RUN, completedAt: undefined, status: "running" }} />,
    );
    expect(screen.getByText(/started 15 September 2026/)).toBeInTheDocument();
  });

  it("states estate coverage (portal count)", () => {
    render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(screen.getByText(/2 portals in the observed estate/)).toBeInTheDocument();
  });

  it("pluralizes a single-portal count correctly", () => {
    render(<AuditContextBanner auditRun={{ ...BASE_RUN, portalCount: 1 }} />);
    expect(screen.getByText(/1 portal in the observed estate/)).toBeInTheDocument();
  });

  it("links to methodology and downloads", () => {
    render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(screen.getByRole("link", { name: "Methodology" })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: "Download data" })).toHaveAttribute("href", "/exports");
  });

  it("states the run status in plain English, not the raw enum value", () => {
    render(<AuditContextBanner auditRun={{ ...BASE_RUN, status: "partial" }} />);
    expect(screen.getByText("Partially completed")).toBeInTheDocument();
    expect(screen.queryByText("partial")).not.toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
