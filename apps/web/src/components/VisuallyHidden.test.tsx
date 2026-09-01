// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { VisuallyHidden } from "./VisuallyHidden";

describe("VisuallyHidden", () => {
  it("renders its children so they remain in the accessibility tree", () => {
    render(<VisuallyHidden>Website (leave blank)</VisuallyHidden>);
    expect(screen.getByText("Website (leave blank)")).toBeInTheDocument();
  });

  it("does not use display:none or visibility:hidden inline styling", () => {
    render(<VisuallyHidden>Website (leave blank)</VisuallyHidden>);
    const node = screen.getByText("Website (leave blank)");
    // CSS Modules are not loaded in the jsdom test environment, so this
    // checks the element carries no inline display:none/visibility:hidden
    // — the actual clip-based rule lives in VisuallyHidden.module.css and
    // is a fixed, non-conditional class the component always applies.
    expect(node.style.display).not.toBe("none");
    expect(node.style.visibility).not.toBe("hidden");
    expect(node.tagName).toBe("SPAN");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<VisuallyHidden>Website (leave blank)</VisuallyHidden>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
