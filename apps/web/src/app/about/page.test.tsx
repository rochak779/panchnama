// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@/lib/constants";
import { ETHICAL_DISCLAIMER } from "@/lib/methodologyContent";
import { getPublishedAuditRun } from "@/lib/publishedRun";
import AboutPage from "./page";

describe("AboutPage", () => {
  it("renders a heading naming the product and the shared ethical disclaimer", () => {
    render(<AboutPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: `About ${PRODUCT_NAME}` }),
    ).toBeInTheDocument();
    expect(screen.getByText(ETHICAL_DISCLAIMER)).toBeInTheDocument();
  });

  it("states the real, published portal count — not a placeholder number", () => {
    const auditRun = getPublishedAuditRun();
    render(<AboutPage />);
    expect(screen.getByText(new RegExp(String(auditRun.portalCount)))).toBeInTheDocument();
  });

  it("links back to the findings and out to the full methodology", () => {
    render(<AboutPage />);
    expect(screen.getByRole("link", { name: /see the findings/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /full methodology/i })).toHaveAttribute(
      "href",
      "/methodology",
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<AboutPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
