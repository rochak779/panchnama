import { describe, expect, it } from "vitest";
import { classifyHttpStatus, classifyNetworkError } from "./crawl-errors.js";

describe("classifyNetworkError", () => {
  it("classifies ENOTFOUND as DNS_FAILURE", () => {
    const err = new TypeError("fetch failed");
    (err as unknown as { cause: unknown }).cause = Object.assign(
      new Error("getaddrinfo ENOTFOUND example.invalid"),
      { code: "ENOTFOUND" },
    );
    expect(classifyNetworkError(err).errorCode).toBe("DNS_FAILURE");
  });

  it("classifies ECONNREFUSED as CONNECT_TIMEOUT (documented convention)", () => {
    const err = new TypeError("fetch failed");
    (err as unknown as { cause: unknown }).cause = Object.assign(
      new Error("connect ECONNREFUSED 127.0.0.1:1"),
      { code: "ECONNREFUSED" },
    );
    expect(classifyNetworkError(err).errorCode).toBe("CONNECT_TIMEOUT");
  });

  it("classifies CERT_HAS_EXPIRED as TLS_CERT_EXPIRED", () => {
    const err = new TypeError("fetch failed");
    (err as unknown as { cause: unknown }).cause = Object.assign(new Error("certificate expired"), {
      code: "CERT_HAS_EXPIRED",
    });
    expect(classifyNetworkError(err).errorCode).toBe("TLS_CERT_EXPIRED");
  });

  it("classifies ERR_TLS_CERT_ALTNAME_INVALID as TLS_HOST_MISMATCH", () => {
    const err = new TypeError("fetch failed");
    (err as unknown as { cause: unknown }).cause = Object.assign(new Error("hostname mismatch"), {
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
    });
    expect(classifyNetworkError(err).errorCode).toBe("TLS_HOST_MISMATCH");
  });

  it("classifies undici's own internal connect timeout (UND_ERR_CONNECT_TIMEOUT) as CONNECT_TIMEOUT", () => {
    // Regression test: a real Session 17 crawl run found genuinely
    // unreachable hosts landing as INTERNAL_AUDIT_ERROR ("fetch failed",
    // ~10.5s duration) instead of CONNECT_TIMEOUT — reproduced live: when
    // undici's own internal connect timeout (default ~10s) fires before
    // this fetcher's own requestTimeoutMs AbortController does, the
    // resulting error's cause carries code "UND_ERR_CONNECT_TIMEOUT",
    // which this classifier previously didn't recognize.
    const err = new TypeError("fetch failed");
    (err as unknown as { cause: unknown }).cause = Object.assign(
      new Error("Connect Timeout Error (attempted address: example.invalid:443, timeout: 10000ms)"),
      { code: "UND_ERR_CONNECT_TIMEOUT" },
    );
    expect(classifyNetworkError(err).errorCode).toBe("CONNECT_TIMEOUT");
  });

  it("classifies undici's internal headers timeout (UND_ERR_HEADERS_TIMEOUT) as CONNECT_TIMEOUT", () => {
    const err = new TypeError("fetch failed");
    (err as unknown as { cause: unknown }).cause = Object.assign(new Error("Headers Timeout Error"), {
      code: "UND_ERR_HEADERS_TIMEOUT",
    });
    expect(classifyNetworkError(err).errorCode).toBe("CONNECT_TIMEOUT");
  });

  it("unwraps AggregateError of DNS lookup attempts", () => {
    const inner = Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    const agg = new AggregateError([inner], "all failed");
    const err = new TypeError("fetch failed");
    (err as unknown as { cause: unknown }).cause = agg;
    expect(classifyNetworkError(err).errorCode).toBe("DNS_FAILURE");
  });

  it("falls back to INTERNAL_AUDIT_ERROR for unrecognized errors", () => {
    expect(classifyNetworkError(new Error("something weird")).errorCode).toBe(
      "INTERNAL_AUDIT_ERROR",
    );
  });

  it("handles non-Error thrown values", () => {
    expect(classifyNetworkError("plain string").errorMessage).toBe("plain string");
  });
});

describe("classifyHttpStatus", () => {
  it("returns undefined for success/redirect statuses", () => {
    expect(classifyHttpStatus(200)).toBeUndefined();
    expect(classifyHttpStatus(301)).toBeUndefined();
  });

  it("maps 401 to AUTH_REQUIRED", () => {
    expect(classifyHttpStatus(401)).toBe("AUTH_REQUIRED");
  });

  it("maps other 4xx to HTTP_CLIENT_ERROR", () => {
    expect(classifyHttpStatus(404)).toBe("HTTP_CLIENT_ERROR");
    expect(classifyHttpStatus(403)).toBe("HTTP_CLIENT_ERROR");
  });

  it("maps 5xx to HTTP_SERVER_ERROR", () => {
    expect(classifyHttpStatus(500)).toBe("HTTP_SERVER_ERROR");
    expect(classifyHttpStatus(503)).toBe("HTTP_SERVER_ERROR");
  });
});
