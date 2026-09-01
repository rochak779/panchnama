import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, handleReadPortalExperiencesMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  handleReadPortalExperiencesMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: getDbMock }));
vi.mock("@/lib/experienceReads", () => ({
  handleReadPortalExperiences: handleReadPortalExperiencesMock,
}));

const { GET, runtime } = await import("./route");

describe("GET /api/portals/:portalId/experiences route wiring", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    handleReadPortalExperiencesMock.mockReset();
  });

  it("declares the Node.js runtime", () => {
    expect(runtime).toBe("nodejs");
  });

  it("resolves the dynamic portalId param and delegates with the db handle", async () => {
    getDbMock.mockReturnValue({ marker: "fake-db" });
    handleReadPortalExperiencesMock.mockResolvedValue(new Response(null, { status: 200 }));

    const request = new Request(
      "https://panchnama.example/api/portals/portal-agri-assam/experiences",
    );
    const response = await GET(request, {
      params: Promise.resolve({ portalId: "portal-agri-assam" }),
    });

    expect(response.status).toBe(200);
    expect(handleReadPortalExperiencesMock).toHaveBeenCalledWith(request, "portal-agri-assam", {
      db: { marker: "fake-db" },
    });
  });
});
