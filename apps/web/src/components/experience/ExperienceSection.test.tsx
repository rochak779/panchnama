// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovedExperience } from "@panchnama/database";
import type { PortalExperienceSummary } from "@panchnama/schema";
import { ExperienceSection } from "./ExperienceSection";
import { fetchPortalExperiences, type FetchExperiencesResult } from "@/lib/experienceApiClient";

vi.mock("@/lib/experienceApiClient", () => ({
  fetchPortalExperiences: vi.fn(),
}));

const mockFetchPortalExperiences = vi.mocked(fetchPortalExperiences);

const PORTAL_ID = "portal-1";
const PORTAL_NAME = "Example Portal";

function makeSummary(overrides: Partial<PortalExperienceSummary> = {}): PortalExperienceSummary {
  return {
    schemaVersion: "1.0.0",
    portalId: PORTAL_ID,
    approvedExperienceCount: 8,
    outcomeCounts: {
      completed: 5,
      partially_completed: 1,
      not_completed: 2,
      information_only: 0,
    },
    themeCounts: { availability: 4, navigation: 2, payment: 1 },
    ratingCount: 6,
    averageRating: 3.2,
    earliestExperienceDate: "2026-01-10T00:00:00Z",
    latestExperienceDate: "2026-08-15T00:00:00Z",
    minimumDisplayThresholdApplied: false,
    generatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function makeItem(overrides: Partial<ApprovedExperience> = {}): ApprovedExperience {
  return {
    submissionId: "sub-1",
    portalId: PORTAL_ID,
    createdAt: "2026-08-01T00:00:00Z",
    occurredOn: "August 2026",
    taskType: "apply_for_scheme_or_benefit",
    taskDescription: null,
    outcome: "completed",
    themes: ["availability"],
    deviceType: "mobile",
    experienceRating: 4,
    publicText: "The site timed out twice before it worked.",
    moderationReasonCode: null,
    ...overrides,
  };
}

function populatedResult(
  overrides: Partial<Extract<FetchExperiencesResult, { ok: true }>> = {},
): FetchExperiencesResult {
  return {
    ok: true,
    page: 1,
    pageSize: 10,
    total: 8,
    items: [makeItem()],
    summary: makeSummary(),
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchPortalExperiences.mockReset();
});

function renderSection() {
  return render(<ExperienceSection portalId={PORTAL_ID} portalName={PORTAL_NAME} />);
}

describe("ExperienceSection", () => {
  it("shows a loading state on mount, announced via aria-live", () => {
    mockFetchPortalExperiences.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByText("Loading citizen experiences…")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("always shows the top share-experience entry point, even while loading", () => {
    mockFetchPortalExperiences.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(
      screen.getByRole("link", { name: `Share your experience with ${PORTAL_NAME}` }),
    ).toHaveAttribute("href", `/portals/${PORTAL_ID}/share-experience`);
  });

  it("transitions from loading to populated", async () => {
    mockFetchPortalExperiences.mockResolvedValue(populatedResult());
    renderSection();
    expect(await screen.findByText(/8 experiences have been shared/)).toBeInTheDocument();
    expect(screen.queryByText("Loading citizen experiences…")).not.toBeInTheDocument();
  });

  it("transitions from loading to empty, with an inviting-not-negative message and an entry point", async () => {
    mockFetchPortalExperiences.mockResolvedValue({
      ok: true,
      page: 1,
      pageSize: 10,
      total: 0,
      items: [],
      summary: makeSummary({
        approvedExperienceCount: 0,
        outcomeCounts: {
          completed: 0,
          partially_completed: 0,
          not_completed: 0,
          information_only: 0,
        },
        themeCounts: {},
        ratingCount: 0,
        averageRating: undefined,
        earliestExperienceDate: undefined,
        latestExperienceDate: undefined,
        minimumDisplayThresholdApplied: true,
      }),
    });
    renderSection();
    expect(
      await screen.findByText("No experiences have been shared for this portal yet"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no one has had problems/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Share your experience" }).length).toBeGreaterThan(
      0,
    );
  });

  it("transitions from loading to unavailable, and the static page still renders around it", async () => {
    mockFetchPortalExperiences.mockResolvedValue({
      ok: false,
      kind: "unavailable",
      message: "Experiences for this portal are temporarily unavailable. Please try again later.",
    });
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Experiences for this portal are temporarily unavailable. Please try again later.",
    );
    // The heading landmark is still present — the section itself degrades,
    // it does not disappear or take the rest of the page with it.
    expect(screen.getByRole("heading", { name: "Citizen experiences" })).toBeInTheDocument();
  });

  it("transitions from loading to a network error", async () => {
    mockFetchPortalExperiences.mockResolvedValue({
      ok: false,
      kind: "network",
      message: "Could not reach Panchnama. Check your connection and try again.",
    });
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach Panchnama. Check your connection and try again.",
    );
  });

  it("renders a rating only when the threshold is not applied and averageRating is present", async () => {
    mockFetchPortalExperiences.mockResolvedValue(
      populatedResult({
        summary: makeSummary({ minimumDisplayThresholdApplied: false, averageRating: 3.2, ratingCount: 14 }),
      }),
    );
    renderSection();
    expect(
      await screen.findByText("Average rating 3.2 of 5, based on 14 ratings."),
    ).toBeInTheDocument();
  });

  it("explains, rather than silently omitting, when the threshold is applied", async () => {
    mockFetchPortalExperiences.mockResolvedValue(
      populatedResult({
        summary: makeSummary({ minimumDisplayThresholdApplied: true, averageRating: 5, ratingCount: 1 }),
      }),
    );
    renderSection();
    expect(
      await screen.findByText(
        "A rating is not shown yet because too few people have rated this portal — an average is only published once at least 5 ratings have been collected.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Average rating/)).not.toBeInTheDocument();
  });

  it("renders the moderation disclaimer and removal-contact copy", async () => {
    mockFetchPortalExperiences.mockResolvedValue(populatedResult());
    renderSection();
    expect(
      await screen.findByText(/These experiences were shared with Panchnama/),
    ).toBeInTheDocument();
    expect(screen.getByText(/To request removal of a published experience/)).toBeInTheDocument();
  });

  it("renders each item's outcome, themes, rating, and date, from the public fields only", async () => {
    mockFetchPortalExperiences.mockResolvedValue(
      populatedResult({
        items: [
          makeItem({
            submissionId: "sub-9",
            outcome: "not_completed",
            themes: ["payment", "language"],
            occurredOn: "March 2026",
            experienceRating: 2,
            publicText: "Redacted public account.",
          }),
        ],
      }),
    );
    renderSection();
    expect(await screen.findByText("Not completed")).toBeInTheDocument();
    expect(screen.getByText("Payment problems")).toBeInTheDocument();
    expect(screen.getByText("Language or translation problems")).toBeInTheDocument();
    expect(screen.getByText("March 2026")).toBeInTheDocument();
    expect(screen.getByText("Rated 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Redacted public account.")).toBeInTheDocument();
  });

  it("paginates: Next re-fetches with the next page and disables at bounds", async () => {
    const user = userEvent.setup();
    mockFetchPortalExperiences.mockResolvedValue(
      populatedResult({ page: 1, pageSize: 1, total: 2, items: [makeItem({ submissionId: "sub-1" })] }),
    );
    renderSection();
    await screen.findByText(/8 experiences have been shared/);

    expect(mockFetchPortalExperiences).toHaveBeenCalledWith(PORTAL_ID, { page: 1 });

    const prevButton = screen.getByRole("button", { name: /Previous page/ });
    expect(prevButton).toBeDisabled();

    mockFetchPortalExperiences.mockResolvedValue(
      populatedResult({ page: 2, pageSize: 1, total: 2, items: [makeItem({ submissionId: "sub-2" })] }),
    );
    const nextButton = screen.getByRole("button", { name: "Next page, page 2 of 2" });
    await user.click(nextButton);

    await waitFor(() =>
      expect(mockFetchPortalExperiences).toHaveBeenCalledWith(PORTAL_ID, { page: 2 }),
    );
    expect(await screen.findByRole("button", { name: /Next page/ })).toBeDisabled();
  });

  it("never imports or references an audit-status field", () => {
    const filePath = path.join(
      process.cwd(),
      "src/components/experience/ExperienceSection.tsx",
    );
    // Strip comments first: the module's own doc comment names these
    // fields to explain that it never touches them — that mention is not
    // a reference in code, so a naive substring check would false-positive
    // on the very sentence documenting the constraint this test enforces.
    const source = readFileSync(filePath, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const forbidden of ["technicalHealth", "severity", "suggestedAction"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("has no detectable accessibility violations in the populated state", async () => {
    mockFetchPortalExperiences.mockResolvedValue(populatedResult());
    const { container } = renderSection();
    await screen.findByText(/8 experiences have been shared/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no detectable accessibility violations in the empty state", async () => {
    mockFetchPortalExperiences.mockResolvedValue({
      ok: true,
      page: 1,
      pageSize: 10,
      total: 0,
      items: [],
      summary: makeSummary({ approvedExperienceCount: 0, ratingCount: 0, averageRating: undefined }),
    });
    const { container } = renderSection();
    await screen.findByText("No experiences have been shared for this portal yet");
    expect(await axe(container)).toHaveNoViolations();
  });
});
