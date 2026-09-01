import { beforeEach, describe, expect, it, vi } from "vitest";

const { getApprovedExperiencesMock, getPortalExperienceSummaryMock } = vi.hoisted(() => ({
  getApprovedExperiencesMock: vi.fn(),
  getPortalExperienceSummaryMock: vi.fn(),
}));

vi.mock("@panchnama/database", () => ({
  getApprovedExperiences: getApprovedExperiencesMock,
  getPortalExperienceSummary: getPortalExperienceSummaryMock,
}));

const { handleReadPortalExperiences } = await import("./experienceReads");

function request(query = ""): Request {
  return new Request(`https://panchnama.example/api/portals/portal-1/experiences${query}`);
}

const FAKE_SUMMARY = { portalId: "portal-1", approvedExperienceCount: 2 };

describe("handleReadPortalExperiences", () => {
  beforeEach(() => {
    getApprovedExperiencesMock.mockReset();
    getPortalExperienceSummaryMock.mockReset();
    getApprovedExperiencesMock.mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 2,
      items: [{ id: "a" }, { id: "b" }],
    });
    getPortalExperienceSummaryMock.mockResolvedValue(FAKE_SUMMARY);
  });

  it("returns 503 when no database is configured, never crashing", async () => {
    const response = await handleReadPortalExperiences(request(), "portal-1", { db: undefined });
    expect(response.status).toBe(503);
    expect(getApprovedExperiencesMock).not.toHaveBeenCalled();
  });

  it("returns approved items and the aggregate summary for a known portal", async () => {
    const db = {} as never;
    const response = await handleReadPortalExperiences(request(), "portal-1", { db });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.portalId).toBe("portal-1");
    expect(body.items).toEqual([{ id: "a" }, { id: "b" }]);
    expect(body.summary).toEqual(FAKE_SUMMARY);
    expect(getApprovedExperiencesMock).toHaveBeenCalledWith(
      db,
      "portal-1",
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
  });

  it("defaults to page 1 / pageSize 10 for missing or invalid query params", async () => {
    const db = {} as never;
    await handleReadPortalExperiences(request("?page=abc&pageSize=xyz"), "portal-1", { db });
    expect(getApprovedExperiencesMock).toHaveBeenCalledWith(
      db,
      "portal-1",
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
  });

  it("clamps pageSize to the maximum of 50", async () => {
    const db = {} as never;
    await handleReadPortalExperiences(request("?pageSize=500"), "portal-1", { db });
    expect(getApprovedExperiencesMock).toHaveBeenCalledWith(
      db,
      "portal-1",
      expect.objectContaining({ pageSize: 50 }),
    );
  });

  it("clamps a non-positive page number up to 1", async () => {
    const db = {} as never;
    await handleReadPortalExperiences(request("?page=-3"), "portal-1", { db });
    expect(getApprovedExperiencesMock).toHaveBeenCalledWith(
      db,
      "portal-1",
      expect.objectContaining({ page: 1 }),
    );
  });

  it("respects a valid explicit page and pageSize", async () => {
    const db = {} as never;
    await handleReadPortalExperiences(request("?page=3&pageSize=25"), "portal-1", { db });
    expect(getApprovedExperiencesMock).toHaveBeenCalledWith(
      db,
      "portal-1",
      expect.objectContaining({ page: 3, pageSize: 25 }),
    );
  });

  it("returns a generic 503 (never a raw error) when the database call fails", async () => {
    getApprovedExperiencesMock.mockRejectedValue(new Error("connection reset by peer"));
    const db = {} as never;
    const response = await handleReadPortalExperiences(request(), "portal-1", { db });
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toMatch(/connection reset/);
  });

  it("never accepts a query parameter to include unapproved submissions", async () => {
    const db = {} as never;
    await handleReadPortalExperiences(
      request("?includeUnapproved=true&status=pending"),
      "portal-1",
      { db },
    );
    // The handler must never read/forward these params — the underlying
    // repository call only ever receives page/pageSize.
    expect(getApprovedExperiencesMock).toHaveBeenCalledWith(
      db,
      "portal-1",
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
    const args = getApprovedExperiencesMock.mock.calls[0]?.[2];
    expect(args).not.toHaveProperty("includeUnapproved");
    expect(args).not.toHaveProperty("status");
  });
});
