import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadEnvMock } = vi.hoisted(() => ({ loadEnvMock: vi.fn() }));

vi.mock("@panchnama/database", () => ({ loadEnv: loadEnvMock }));

// Imported after the mock so the module under test picks up the mocked
// `loadEnv`.
const { getAbuseKeySecret, MissingAbuseKeySecretError } = await import("./abuseKeySecret");

describe("getAbuseKeySecret", () => {
  beforeEach(() => {
    loadEnvMock.mockReset();
  });

  it("returns the configured secret", () => {
    loadEnvMock.mockReturnValue({ EXPERIENCE_ABUSE_KEY_SECRET: "a-long-random-value" });
    expect(getAbuseKeySecret()).toBe("a-long-random-value");
  });

  it("throws a typed, actionable error when the secret is not configured", () => {
    loadEnvMock.mockReturnValue({});
    expect(() => getAbuseKeySecret()).toThrow(MissingAbuseKeySecretError);
    expect(() => getAbuseKeySecret()).toThrow(/EXPERIENCE_ABUSE_KEY_SECRET/);
  });
});
