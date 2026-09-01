// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No experiences yet"
        description="Be the first to share how using this portal went."
      />,
    );
    expect(screen.getByText("No experiences yet")).toBeInTheDocument();
    expect(
      screen.getByText("Be the first to share how using this portal went."),
    ).toBeInTheDocument();
  });

  it("renders an optional action", () => {
    render(
      <EmptyState
        title="No experiences yet"
        description="Be the first."
        action={<button type="button">Share an experience</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Share an experience" })).toBeInTheDocument();
  });

  it("announces itself as a status, not an alert (a normal, non-error outcome)", () => {
    render(<EmptyState title="No experiences yet" description="Be the first." />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <EmptyState title="No experiences yet" description="Be the first." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
