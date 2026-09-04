// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { AuditContextBanner } from "./AuditContextBanner";

const BASE_RUN = {
  startedAt: "2026-09-15T02:00:00Z",
  completedAt: "2026-09-15T04:30:00Z",
  geography: "assam" as const,
};

describe("AuditContextBanner", () => {
  it("states the last-audited date in plain English", () => {
    render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(screen.getByText("Last audited:")).toBeInTheDocument();
    expect(screen.getByText("15 September 2026")).toBeInTheDocument();
  });

  it("falls back to the start date, labeled, when the run has not completed", () => {
    render(<AuditContextBanner auditRun={{ ...BASE_RUN, completedAt: undefined }} />);
    expect(screen.getByText(/started 15 September 2026/)).toBeInTheDocument();
  });

  it("states coverage as the audited geography, capitalized", () => {
    render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(screen.getByText("Coverage:")).toBeInTheDocument();
    expect(screen.getByText("Assam")).toBeInTheDocument();
  });

  it("carries no methodology/download links or portal count/run-status text of its own", () => {
    render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/portal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/partial|completed|in progress|failed/i)).not.toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<AuditContextBanner auditRun={BASE_RUN} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
