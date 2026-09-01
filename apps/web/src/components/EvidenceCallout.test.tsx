// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { EvidenceCallout } from "./EvidenceCallout";

describe("EvidenceCallout", () => {
  it("renders the heading and content", () => {
    render(
      <EvidenceCallout heading="Evidence">Observed HTTP 503 on three attempts.</EvidenceCallout>,
    );
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("Observed HTTP 503 on three attempts.")).toBeInTheDocument();
  });

  it("renders optional citation meta (timestamp/rule/source) when supplied", () => {
    render(
      <EvidenceCallout heading="Evidence" meta={<span>Rule: availability.unavailable.v1</span>}>
        Body
      </EvidenceCallout>,
    );
    expect(screen.getByText("Rule: availability.unavailable.v1")).toBeInTheDocument();
  });

  it("omits the meta row entirely when none is supplied", () => {
    const { container } = render(<EvidenceCallout heading="Evidence">Body</EvidenceCallout>);
    expect(container.textContent).not.toMatch(/Rule:/);
  });

  it("never renders a small eyebrow/kicker label above a separate larger heading — 'heading' is the only heading", () => {
    render(<EvidenceCallout heading="Evidence">Body</EvidenceCallout>);
    // Exactly one element carries the heading text, at one visual weight.
    expect(screen.getAllByText("Evidence")).toHaveLength(1);
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <EvidenceCallout heading="Evidence" meta={<span>2026-09-15</span>}>
        Observed HTTP 503 on three attempts.
      </EvidenceCallout>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
