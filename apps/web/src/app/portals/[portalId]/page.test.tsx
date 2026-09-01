// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { getFixturePortalAssessments } from "@/lib/publishedFixtures";
import PortalDetailPage, { generateMetadata, generateStaticParams } from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("PortalDetailPage (builds from real data/fixtures/*.json)", () => {
  it("generates one static param per real fixture portal", () => {
    const params = generateStaticParams();
    const assessments = getFixturePortalAssessments();
    expect(params).toEqual(assessments.map((a) => ({ portalId: a.portal.id })));
  });

  it("generates page metadata using the real portal's name", () => {
    const [first] = getFixturePortalAssessments();
    const metadata = generateMetadata({ params: { portalId: first!.portal.id } });
    expect(metadata.title).toBe(first!.portal.name);
  });

  it("renders a real fixture portal end to end", () => {
    const [first] = getFixturePortalAssessments();
    render(<PortalDetailPage params={{ portalId: first!.portal.id }} />);
    expect(screen.getByRole("heading", { level: 1, name: first!.portal.name })).toBeInTheDocument();
  });

  it("calls notFound() for an unknown portal id", () => {
    expect(() => render(<PortalDetailPage params={{ portalId: "no-such-portal" }} />)).toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("has no detectable accessibility violations on a real fixture portal", async () => {
    const [first] = getFixturePortalAssessments();
    const { container } = render(<PortalDetailPage params={{ portalId: first!.portal.id }} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
