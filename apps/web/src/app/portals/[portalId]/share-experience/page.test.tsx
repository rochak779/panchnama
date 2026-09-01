// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getFixturePortalAssessments } from "@/lib/publishedFixtures";
import ShareExperiencePage, { generateMetadata, generateStaticParams } from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("ShareExperiencePage (builds from real data/fixtures/*.json)", () => {
  it("generates one static param per real fixture portal", () => {
    const params = generateStaticParams();
    const assessments = getFixturePortalAssessments();
    expect(params).toEqual(assessments.map((a) => ({ portalId: a.portal.id })));
  });

  it("generates page metadata using the real portal's name", () => {
    const [first] = getFixturePortalAssessments();
    const metadata = generateMetadata({ params: { portalId: first!.portal.id } });
    expect(metadata.title).toBe(`Share your experience — ${first!.portal.name}`);
  });

  it("renders the form shell for a known fixture portal", () => {
    const [first] = getFixturePortalAssessments();
    render(<ShareExperiencePage params={{ portalId: first!.portal.id }} />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: `Share your experience — ${first!.portal.name}`,
      }),
    ).toBeInTheDocument();
  });

  it("calls notFound() for an unknown portal id", () => {
    expect(() =>
      render(<ShareExperiencePage params={{ portalId: "no-such-portal" }} />),
    ).toThrow("NEXT_NOT_FOUND");
  });
});
