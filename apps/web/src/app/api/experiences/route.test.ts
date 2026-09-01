import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAbuseKeySecretMock, getDbMock, handleSubmitExperienceMock } = vi.hoisted(() => ({
  getAbuseKeySecretMock: vi.fn(),
  getDbMock: vi.fn(),
  handleSubmitExperienceMock: vi.fn(),
}));

vi.mock("@/lib/abuseKeySecret", () => ({ getAbuseKeySecret: getAbuseKeySecretMock }));
vi.mock("@/lib/db", () => ({ getDb: getDbMock }));
vi.mock("@/lib/experienceSubmission", () => ({
  handleSubmitExperience: handleSubmitExperienceMock,
}));

const { POST, runtime } = await import("./route");

describe("POST /api/experiences route wiring", () => {
  beforeEach(() => {
    getAbuseKeySecretMock.mockReset();
    getDbMock.mockReset();
    handleSubmitExperienceMock.mockReset();
  });

  it("declares the Node.js runtime (required for the raw-TCP Postgres driver)", () => {
    expect(runtime).toBe("nodejs");
  });

  it("returns a generic 503 when the abuse-key secret is not configured, without crashing", async () => {
    getAbuseKeySecretMock.mockImplementation(() => {
      throw new Error("EXPERIENCE_ABUSE_KEY_SECRET is not set.");
    });
    const request = new Request("https://panchnama.example/api/experiences", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect(handleSubmitExperienceMock).not.toHaveBeenCalled();
  });

  it("delegates to handleSubmitExperience with the db handle and secret when configured", async () => {
    getAbuseKeySecretMock.mockReturnValue("secret");
    getDbMock.mockReturnValue({ marker: "fake-db" });
    handleSubmitExperienceMock.mockResolvedValue(new Response(null, { status: 201 }));

    const request = new Request("https://panchnama.example/api/experiences", { method: "POST" });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(handleSubmitExperienceMock).toHaveBeenCalledWith(request, {
      db: { marker: "fake-db" },
      abuseKeySecret: "secret",
    });
  });
});
