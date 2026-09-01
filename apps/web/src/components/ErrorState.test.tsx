// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders title and description", () => {
    render(<ErrorState title="Temporarily unavailable" description="Please try again later." />);
    expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText("Please try again later.")).toBeInTheDocument();
  });

  it("announces itself as an alert, unlike EmptyState's status role", () => {
    render(<ErrorState title="Temporarily unavailable" description="Please try again later." />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders an optional retry action", () => {
    render(
      <ErrorState
        title="Temporarily unavailable"
        description="Please try again later."
        action={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <ErrorState title="Temporarily unavailable" description="Please try again later." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
