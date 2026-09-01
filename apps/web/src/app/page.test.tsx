// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { PRODUCT_DISCLAIMER, PRODUCT_NAME } from "@/lib/constants";
import HomePage from "./page";

describe("HomePage / Assam overview (builds from real data/fixtures/*.json)", () => {
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

  it("shows technical-health counts that match the fixture data (6 portals: 3 healthy, 1 degraded, 1 unavailable, 1 not assessable)", () => {
    render(<HomePage />);
    const section = screen.getByRole("heading", { name: "Technical health" }).closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveTextContent("Healthy");
    expect(tiles[0]).toHaveTextContent("3");
    expect(tiles[1]).toHaveTextContent("Degraded");
    expect(tiles[1]).toHaveTextContent("1");
    expect(tiles[2]).toHaveTextContent("Unavailable");
    expect(tiles[2]).toHaveTextContent("1");
    expect(tiles[3]).toHaveTextContent("Not assessable");
    expect(tiles[3]).toHaveTextContent("1");
  });

  it("shows severity counts derived from the fixture assessments", () => {
    render(<HomePage />);
    const section = screen
      .getByRole("heading", { name: "Findings by severity" })
      .closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    expect(tiles[0]).toHaveTextContent("Critical");
    expect(tiles[0]).toHaveTextContent("1");
    expect(tiles[1]).toHaveTextContent("Significant");
    expect(tiles[1]).toHaveTextContent("1");
    expect(tiles[2]).toHaveTextContent("Advisory");
    expect(tiles[2]).toHaveTextContent("3");
  });

  it("shows suggested-action counts without ever collapsing them into one score", () => {
    render(<HomePage />);
    const section = screen.getByRole("heading", { name: "Suggested actions" }).closest("section")!;
    const tiles = within(section).getAllByRole("listitem");
    expect(tiles).toHaveLength(5);
  });

  it("never renders a composite/single score", () => {
    render(<HomePage />);
    expect(document.body.textContent).not.toMatch(/overall score/i);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("lists priority findings ordered critical first", () => {
    render(<HomePage />);
    const section = screen.getByRole("heading", { name: "Priority findings" }).closest("section")!;
    const items = within(section).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Portal entry point unreachable");
    expect(items[0]).toHaveTextContent("Assam Transport Department Portal");
  });

  it("lists the directory mismatch finding separately from priority findings", () => {
    render(<HomePage />);
    const section = screen
      .getByRole("heading", { name: "Directory mismatch summary" })
      .closest("section")!;
    expect(
      within(section).getByText(/Directory entry links to a different destination/),
    ).toBeInTheDocument();
    expect(
      within(section).getByText("Assam Panchayat and Rural Development Portal"),
    ).toBeInTheDocument();
  });

  it("names the not-assessable portal and its reason in the limitations section", () => {
    render(<HomePage />);
    const section = screen.getByRole("heading", { name: "Limitations" }).closest("section")!;
    expect(section.textContent).toMatch(/Assam Education Department Portal/);
    expect(section.textContent).toMatch(/CAPTCHA challenge/);
  });

  it("notes the run is partial, since the fixture audit run mixes outcomes", () => {
    render(<HomePage />);
    expect(document.body.textContent).toMatch(/marked\s*[“"]partial[”"]/);
  });

  it("links to inventory, methodology, and exports", () => {
    render(<HomePage />);
    const nav = screen.getByRole("navigation", { name: "Investigate further" });
    expect(within(nav).getByRole("link", { name: /website inventory/i })).toHaveAttribute(
      "href",
      "/inventory",
    );
    expect(within(nav).getByRole("link", { name: /methodology/i })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(within(nav).getByRole("link", { name: /audit dataset/i })).toHaveAttribute(
      "href",
      "/exports",
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<HomePage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
