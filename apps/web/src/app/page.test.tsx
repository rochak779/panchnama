// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { PRODUCT_DISCLAIMER, PRODUCT_NAME } from "@/lib/constants";
import HomePage from "./page";

describe("HomePage (builds from real data/fixtures/*.json)", () => {
  it("renders the product name and independence disclaimer", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: PRODUCT_NAME })).toBeInTheDocument();
    expect(screen.getByText(PRODUCT_DISCLAIMER)).toBeInTheDocument();
  });

  it("has a real <main> landmark matching the header's skip link target", () => {
    render(<HomePage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
  });

  it("lists every fixture portal with its technical-health status badge", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Assam Agriculture Department Portal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Assam Farmers Welfare Portal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<HomePage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
