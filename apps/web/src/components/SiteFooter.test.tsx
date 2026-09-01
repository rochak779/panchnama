// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { PRODUCT_DISCLAIMER } from "@/lib/constants";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("links to methodology, exports, inventory, and the privacy/moderation policy", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Methodology" })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: "Download the dataset" })).toHaveAttribute(
      "href",
      "/exports",
    );
    expect(screen.getByRole("link", { name: "Website inventory" })).toHaveAttribute(
      "href",
      "/inventory",
    );
    expect(screen.getByRole("link", { name: "Privacy & moderation policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("repeats the exact independence disclaimer text", () => {
    render(<SiteFooter />);
    expect(screen.getByText(PRODUCT_DISCLAIMER)).toBeInTheDocument();
  });

  it("uses a real <footer> landmark and a labeled nav", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<SiteFooter />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
