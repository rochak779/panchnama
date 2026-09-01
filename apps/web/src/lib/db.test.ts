import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadEnvMock, createDbClientMock } = vi.hoisted(() => ({
  loadEnvMock: vi.fn(),
  createDbClientMock: vi.fn(),
}));

class FakeMissingDatabaseUrlError extends Error {}

vi.mock("@panchnama/database", () => ({
  loadEnv: loadEnvMock,
  createDbClient: createDbClientMock,
  MissingDatabaseUrlError: FakeMissingDatabaseUrlError,
}));

const { getDb, getDbHandle, resetDbHandleForTests } = await import("./db");

describe("getDbHandle / getDb", () => {
  beforeEach(() => {
    loadEnvMock.mockReset();
    createDbClientMock.mockReset();
    resetDbHandleForTests();
  });

  afterEach(() => {
    resetDbHandleForTests();
  });

  it("returns undefined without throwing when DATABASE_URL is not set", () => {
    loadEnvMock.mockReturnValue({});
    expect(getDbHandle()).toBeUndefined();
    expect(getDb()).toBeUndefined();
    expect(createDbClientMock).not.toHaveBeenCalled();
  });

  it("creates and caches a single client for a configured DATABASE_URL", () => {
    loadEnvMock.mockReturnValue({ DATABASE_URL: "postgres://example/db" });
    const fakeHandle = { db: { marker: "fake-db" } };
    createDbClientMock.mockReturnValue(fakeHandle);

    const first = getDbHandle();
    const second = getDbHandle();

    expect(first).toBe(fakeHandle);
    expect(second).toBe(fakeHandle);
    expect(createDbClientMock).toHaveBeenCalledTimes(1);
    expect(getDb()).toBe(fakeHandle.db);
  });

  it("only attempts connection setup once even after a missing-URL result", () => {
    loadEnvMock.mockReturnValue({});
    getDbHandle();
    getDbHandle();
    expect(loadEnvMock).toHaveBeenCalledTimes(1);
  });

  it("resetDbHandleForTests() allows a later call to re-attempt setup", () => {
    loadEnvMock.mockReturnValue({});
    getDbHandle();
    resetDbHandleForTests();
    loadEnvMock.mockReturnValue({ DATABASE_URL: "postgres://example/db" });
    createDbClientMock.mockReturnValue({ db: {} });
    getDbHandle();
    expect(loadEnvMock).toHaveBeenCalledTimes(2);
  });
});
