// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { SeverityMarker } from "./SeverityMarker";
import { SEVERITY_VISUALS } from "./statusTokens";

describe("SeverityMarker", () => {
  it.each(Object.keys(SEVERITY_VISUALS) as (keyof typeof SEVERITY_VISUALS)[])(
    "renders the text label for severity %s",
    (severity) => {
      render(<SeverityMarker severity={severity} />);
      expect(screen.getByText(SEVERITY_VISUALS[severity].label)).toBeInTheDocument();
    },
  );

  it("gives each severity a distinct icon shape, not just a distinct color", () => {
    const critical = render(<SeverityMarker severity="critical" />);
    const criticalPath = critical.container.querySelector("svg")?.outerHTML;
    critical.unmount();

    const advisory = render(<SeverityMarker severity="advisory" />);
    const advisoryPath = advisory.container.querySelector("svg")?.outerHTML;

    expect(criticalPath).not.toEqual(advisoryPath);
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <ul>
        <li>
          <SeverityMarker severity="critical" />
        </li>
        <li>
          <SeverityMarker severity="significant" />
        </li>
        <li>
          <SeverityMarker severity="advisory" />
        </li>
      </ul>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
