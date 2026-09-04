// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("renders the wordmark linking home", () => {
    render(<SiteHeader />);
    const wordmark = screen.getByRole("link", { name: "Panchnama" });
    expect(wordmark).toHaveAttribute("href", "/");
  });

  it("carries no independence-tag text of its own — that lives on /about and in the footer", () => {
    render(<SiteHeader />);
    expect(screen.queryByText(/not a government website/i)).not.toBeInTheDocument();
  });

  it("exposes primary navigation as a labeled landmark with real links", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Inventory" })).toHaveAttribute("href", "/inventory");
    expect(screen.getByRole("link", { name: "Methodology" })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  });

  it("uses a real <header> landmark", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<SiteHeader />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
