import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeUnknownPortalIdError extends Error {
  constructor(public readonly portalId: string) {
    super(`unknown portal ${portalId}`);
    this.name = "UnknownPortalIdError";
  }
}

class FakeDatabaseUnavailableError extends Error {
  constructor(public override readonly cause: unknown) {
    super("The database is currently unavailable.");
    this.name = "DatabaseUnavailableError";
  }
}

const {
  countEventsInWindowMock,
  createPendingSubmissionMock,
  findDuplicateCandidatesMock,
  recordAbuseKeyEventMock,
} = vi.hoisted(() => ({
  countEventsInWindowMock: vi.fn(),
  createPendingSubmissionMock: vi.fn(),
  findDuplicateCandidatesMock: vi.fn(),
  recordAbuseKeyEventMock: vi.fn(),
}));

vi.mock("@panchnama/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@panchnama/database")>();
  return {
    ...actual,
    countEventsInWindow: countEventsInWindowMock,
    createPendingSubmission: createPendingSubmissionMock,
    findDuplicateCandidates: findDuplicateCandidatesMock,
    recordAbuseKeyEvent: recordAbuseKeyEventMock,
    UnknownPortalIdError: FakeUnknownPortalIdError,
    DatabaseUnavailableError: FakeDatabaseUnavailableError,
  };
});

const { handleSubmitExperience } = await import("./experienceSubmission");

const PORTAL_ID = "portal-agri-assam";
const NOW = new Date("2026-08-31T12:00:00.000Z");

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    portalId: PORTAL_ID,
    taskType: "find_information",
    outcome: "completed",
    themes: ["navigation"],
    consentToPublish: true,
    ...overrides,
  };
}

function makeRequest(
  body: unknown,
  init: { contentType?: string; origin?: string; host?: string } = {},
): Request {
  const host = init.host ?? "panchnama.example";
  const headers: Record<string, string> = {
    "content-type": init.contentType ?? "application/json",
    host,
  };
  if (init.origin !== null) headers.origin = init.origin ?? `https://${host}`;
  return new Request("https://panchnama.example/api/experiences", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** By default: no rate limit hit, no duplicate window activity. Tests
 * override with `countEventsInWindowMock.mockImplementation` for specific
 * scenarios. Distinguishes the three call shapes (global/portal/duplicate)
 * by `sinceHours`, since portalId alone does not disambiguate portal-cap
 * from duplicate-window calls. Note `countEventsInWindow(db, input)` takes
 * `db` as its first argument — the mock implementation's first parameter is
 * `db`, not `input`. */
function defaultCountEventsImpl(
  _db: unknown,
  _input: { keyedHash: string; portalId?: string; sinceHours: number },
): number {
  return 0;
}

function baseDeps(overrides: Partial<Parameters<typeof handleSubmitExperience>[1]> = {}) {
  return {
    db: {} as never,
    abuseKeySecret: "test-secret",
    now: () => NOW,
    getClientIp: () => "203.0.113.5",
    loadPortalIds: () => ({ available: true, ids: new Set([PORTAL_ID]) }),
    ...overrides,
  };
}

describe("handleSubmitExperience", () => {
  beforeEach(() => {
    countEventsInWindowMock.mockReset();
    createPendingSubmissionMock.mockReset();
    findDuplicateCandidatesMock.mockReset();
    recordAbuseKeyEventMock.mockReset();
    countEventsInWindowMock.mockImplementation(defaultCountEventsImpl);
    createPendingSubmissionMock.mockResolvedValue({ id: "submission-1" });
    findDuplicateCandidatesMock.mockResolvedValue([]);
    recordAbuseKeyEventMock.mockResolvedValue(undefined);
  });

  it("rejects a non-JSON content type", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody(), { contentType: "text/plain" }),
      baseDeps(),
    );
    expect(response.status).toBe(400);
    expect(createPendingSubmissionMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request (origin/CSRF protection)", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody(), { origin: "https://attacker.example" }),
      baseDeps(),
    );
    expect(response.status).toBe(403);
    expect(createPendingSubmissionMock).not.toHaveBeenCalled();
  });

  it("rejects a request body over the 8 KB limit", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody({ freeText: "a".repeat(9000) })),
      baseDeps(),
    );
    expect(response.status).toBe(400);
    expect(createPendingSubmissionMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await handleSubmitExperience(makeRequest("{not json"), baseDeps());
    expect(response.status).toBe(400);
  });

  it("rejects a schema-invalid body with field-level errors", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody({ taskType: "not_a_real_type" })),
      baseDeps(),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.fieldErrors).toBeDefined();
  });

  it("silently accepts (without storing) a request with the honeypot field filled", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody({ website: "http://spambot.example" })),
      baseDeps(),
    );
    expect(response.status).toBe(201);
    expect(createPendingSubmissionMock).not.toHaveBeenCalled();
  });

  it("returns 503 when no published inventory is available yet", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody()),
      baseDeps({ loadPortalIds: () => ({ available: false, ids: new Set() }) }),
    );
    expect(response.status).toBe(503);
  });

  it("rejects a portalId that is not part of the published inventory", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody({ portalId: "unknown-portal" })),
      baseDeps(),
    );
    expect(response.status).toBe(400);
    expect(createPendingSubmissionMock).not.toHaveBeenCalled();
  });

  it("returns 503 when no database is configured", async () => {
    const response = await handleSubmitExperience(
      makeRequest(validBody()),
      baseDeps({ db: undefined }),
    );
    expect(response.status).toBe(503);
  });

  it("accepts a valid submission for a known portal and stores it as pending", async () => {
    const response = await handleSubmitExperience(makeRequest(validBody()), baseDeps());
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("pending");
    // The internal submission id must never be echoed back to the client.
    expect(JSON.stringify(body)).not.toMatch(/submission-1/);
    expect(createPendingSubmissionMock).toHaveBeenCalledTimes(1);
    const [, input] = createPendingSubmissionMock.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(input.portalId).toBe(PORTAL_ID);
    expect(input.source).toBe("public_form");
    expect(recordAbuseKeyEventMock).toHaveBeenCalledTimes(1);
  });

  it("returns 429 (without exposing abuse-key detail) once the global 24h rate limit is reached", async () => {
    countEventsInWindowMock.mockImplementation((_db, { portalId, sinceHours }) =>
      !portalId && sinceHours === 24 ? 5 : 0,
    );
    const response = await handleSubmitExperience(makeRequest(validBody()), baseDeps());
    expect(response.status).toBe(429);
    const body = (await response.json()) as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toMatch(/hash|secret|ip/i);
    expect(createPendingSubmissionMock).not.toHaveBeenCalled();
  });

  it("returns 429 once the per-portal 24h rate limit is reached", async () => {
    countEventsInWindowMock.mockImplementation((_db, { portalId, sinceHours }) =>
      portalId && sinceHours === 24 ? 2 : 0,
    );
    const response = await handleSubmitExperience(makeRequest(validBody()), baseDeps());
    expect(response.status).toBe(429);
    expect(createPendingSubmissionMock).not.toHaveBeenCalled();
  });

  it("detects a likely email address in free text as a privacy flag, without rejecting the submission", async () => {
    await handleSubmitExperience(
      makeRequest(validBody({ freeText: "reach me at citizen@example.com" })),
      baseDeps(),
    );
    const [, input] = createPendingSubmissionMock.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(input.privacyFlags).toContain("possible_email");
  });

  it("stores no privacy flags for text with no matching pattern", async () => {
    await handleSubmitExperience(
      makeRequest(validBody({ freeText: "the page took a while to load" })),
      baseDeps(),
    );
    const [, input] = createPendingSubmissionMock.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(input.privacyFlags).toEqual([]);
  });

  it("marks a submission as duplicateOf a recent matching submission from the same abuse key", async () => {
    countEventsInWindowMock.mockImplementation((_db, { portalId, sinceHours }) =>
      portalId && sinceHours < 1 ? 1 : 0,
    );
    findDuplicateCandidatesMock.mockResolvedValue([
      {
        id: "existing-1",
        taskDescription: "Applied for pension",
        themes: ["navigation"],
        occurredOn: undefined,
        freeText: null,
        createdAt: NOW,
      },
    ]);
    await handleSubmitExperience(
      makeRequest(validBody({ taskDescription: "Applied for pension" })),
      baseDeps(),
    );
    const [, input] = createPendingSubmissionMock.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(input.duplicateOf).toBe("existing-1");
  });

  it("does not run duplicate lookup at all when the abuse key has no recent activity for this portal", async () => {
    await handleSubmitExperience(makeRequest(validBody()), baseDeps());
    expect(findDuplicateCandidatesMock).not.toHaveBeenCalled();
  });

  it("returns a generic 503 (never the raw error) when the database call fails", async () => {
    createPendingSubmissionMock.mockRejectedValue(new Error("connection refused: 10.0.0.5:5432"));
    const response = await handleSubmitExperience(makeRequest(validBody()), baseDeps());
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toMatch(/10\.0\.0\.5|connection refused/);
  });

  it("returns 400 when the repository itself rejects an unknown portal id", async () => {
    createPendingSubmissionMock.mockRejectedValue(new FakeUnknownPortalIdError(PORTAL_ID));
    const response = await handleSubmitExperience(makeRequest(validBody()), baseDeps());
    expect(response.status).toBe(400);
  });

  it("never derives the abuse key from a client-suppliable value (uses server-side IP extraction)", async () => {
    const getClientIp = vi.fn().mockReturnValue("203.0.113.5");
    await handleSubmitExperience(makeRequest(validBody()), baseDeps({ getClientIp }));
    expect(getClientIp).toHaveBeenCalledTimes(1);
  });
});
