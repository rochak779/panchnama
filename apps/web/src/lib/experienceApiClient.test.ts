import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPortalExperiences, submitExperience } from "./experienceApiClient";
import { HONEYPOT_FIELD_NAME } from "./requestSchema";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const BASE_PAYLOAD = {
  occurredOn: "2026-08",
  taskType: "find_information" as const,
  taskDescription: "Looked for a form",
  outcome: "completed" as const,
  themes: ["navigation" as const],
  deviceType: "mobile" as const,
  experienceRating: 4 as const,
  freeText: "It took a while to find the right page.",
  consentToPublish: true,
};

describe("submitExperience", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a 201 pending response to ok: true", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: "pending", message: "Thank you." }, 201),
    );

    const result = await submitExperience("portal-1", BASE_PAYLOAD, "");

    expect(result).toEqual({ ok: true, message: "Thank you." });
  });

  it("maps a 400 invalid response to kind: invalid, including fieldErrors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { status: "invalid", message: "Submission failed validation.", fieldErrors: { outcome: ["Required"] } },
        400,
      ),
    );

    const result = await submitExperience("portal-1", BASE_PAYLOAD, "");

    expect(result).toEqual({
      ok: false,
      kind: "invalid",
      message: "Submission failed validation.",
      fieldErrors: { outcome: ["Required"] },
    });
  });

  it("maps a 429 rate_limited response to kind: rate_limited with retryAfterSeconds", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { status: "rate_limited", message: "Too many submissions.", retryAfterSeconds: 3600 },
        429,
      ),
    );

    const result = await submitExperience("portal-1", BASE_PAYLOAD, "");

    expect(result).toEqual({
      ok: false,
      kind: "rate_limited",
      message: "Too many submissions.",
      retryAfterSeconds: 3600,
    });
  });

  it("maps a 503 unavailable response to kind: unavailable", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: "unavailable", message: "Try again later." }, 503),
    );

    const result = await submitExperience("portal-1", BASE_PAYLOAD, "");

    expect(result).toEqual({ ok: false, kind: "unavailable", message: "Try again later." });
  });

  it("maps a thrown/rejected fetch to kind: network", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await submitExperience("portal-1", BASE_PAYLOAD, "");

    expect(result.ok).toBe(false);
    expect(result as { kind: string }).toMatchObject({ kind: "network" });
  });

  it("maps an unexpected status (e.g. 403 forbidden) to kind: unavailable rather than throwing", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: "forbidden", message: "nope" }, 403));

    const result = await submitExperience("portal-1", BASE_PAYLOAD, "");

    expect(result.ok).toBe(false);
    expect(result as { kind: string }).toMatchObject({ kind: "unavailable" });
  });

  it("includes the honeypot field under the exact 'website' key when a non-empty value is passed", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(jsonResponse({ status: "pending", message: "Thank you." }, 201));

    await submitExperience("portal-1", BASE_PAYLOAD, "bot-filled-value");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/experiences");
    expect(init?.credentials).toBe("same-origin");
    const sentBody = JSON.parse(init!.body as string);
    expect(sentBody[HONEYPOT_FIELD_NAME]).toBe("bot-filled-value");
    expect(HONEYPOT_FIELD_NAME).toBe("website");
    expect(sentBody.website).toBe("bot-filled-value");
    expect(sentBody.portalId).toBe("portal-1");
  });

  it("includes an empty honeypot field under 'website' for a legitimate submission", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(jsonResponse({ status: "pending", message: "Thank you." }, 201));

    await submitExperience("portal-1", BASE_PAYLOAD, "");

    const [, init] = mockFetch.mock.calls[0]!;
    const sentBody = JSON.parse(init!.body as string);
    expect(sentBody.website).toBe("");
  });
});

describe("fetchPortalExperiences", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a 200 response to ok: true with items and summary", async () => {
    const items = [
      {
        submissionId: "sub-1",
        portalId: "portal-1",
        createdAt: "2026-08-01T00:00:00.000Z",
        occurredOn: "2026-08",
        taskType: "find_information",
        taskDescription: null,
        outcome: "completed",
        themes: ["navigation"],
        deviceType: "mobile",
        experienceRating: 4,
        publicText: "It took a while.",
        moderationReasonCode: null,
      },
    ];
    const summary = {
      schemaVersion: "1.0.0",
      portalId: "portal-1",
      approvedExperienceCount: 1,
      outcomeCounts: { completed: 1, partially_completed: 0, not_completed: 0, information_only: 0 },
      themeCounts: { navigation: 1 },
      ratingCount: 1,
      averageRating: 4,
      minimumDisplayThresholdApplied: true,
      generatedAt: "2026-08-01T00:00:00.000Z",
    };
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ portalId: "portal-1", page: 1, pageSize: 10, total: 1, items, summary }, 200),
    );

    const result = await fetchPortalExperiences("portal-1", { page: 1 });

    expect(result).toEqual({ ok: true, page: 1, pageSize: 10, total: 1, items, summary });
  });

  it("requests the given page via the query string", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      jsonResponse(
        {
          portalId: "portal-1",
          page: 2,
          pageSize: 10,
          total: 0,
          items: [],
          summary: {
            schemaVersion: "1.0.0",
            portalId: "portal-1",
            approvedExperienceCount: 0,
            outcomeCounts: {
              completed: 0,
              partially_completed: 0,
              not_completed: 0,
              information_only: 0,
            },
            themeCounts: {},
            ratingCount: 0,
            minimumDisplayThresholdApplied: true,
            generatedAt: "2026-08-01T00:00:00.000Z",
          },
        },
        200,
      ),
    );

    await fetchPortalExperiences("portal-1", { page: 2 });

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/portals/portal-1/experiences?page=2");
  });

  it("maps a 503 unavailable response to kind: unavailable", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: "unavailable", message: "Try again later." }, 503),
    );

    const result = await fetchPortalExperiences("portal-1", {});

    expect(result).toEqual({ ok: false, kind: "unavailable", message: "Try again later." });
  });

  it("maps a thrown/rejected fetch to kind: network", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await fetchPortalExperiences("portal-1", {});

    expect(result.ok).toBe(false);
    expect(result as { kind: string }).toMatchObject({ kind: "network" });
  });
});
