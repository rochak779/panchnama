// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";
import { TECHNICAL_HEALTH_VISUALS } from "./statusTokens";

describe("StatusBadge", () => {
  it.each(Object.keys(TECHNICAL_HEALTH_VISUALS) as (keyof typeof TECHNICAL_HEALTH_VISUALS)[])(
    "renders the text label for status %s (never icon/color alone)",
    (status) => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(TECHNICAL_HEALTH_VISUALS[status].label)).toBeInTheDocument();
    },
  );

  it("renders both an icon and a label together for a given status", () => {
    const { container } = render(<StatusBadge status="degraded" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("marks its icon aria-hidden so the accessible name comes from the text label alone", () => {
    const { container } = render(<StatusBadge status="unavailable" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <ul>
        <li>
          <StatusBadge status="healthy" />
        </li>
        <li>
          <StatusBadge status="degraded" />
        </li>
        <li>
          <StatusBadge status="unavailable" />
        </li>
        <li>
          <StatusBadge status="not_assessable" />
        </li>
      </ul>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
