import { describe, expect, it } from "vitest";
import {
  forbiddenResponse,
  invalidRequestResponse,
  jsonResponse,
  rateLimitedResponse,
  serviceUnavailableResponse,
  submissionAcceptedResponse,
  SUBMISSION_CONFIRMATION_MESSAGE,
  tooLargeResponse,
} from "./apiResponses";

describe("jsonResponse", () => {
  it("sets the status code and content-type", async () => {
    const response = jsonResponse({ a: 1 }, 200);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ a: 1 });
  });
});

describe("submissionAcceptedResponse", () => {
  it("returns a generic 201 receipt with the section 9.6 confirmation text", async () => {
    const response = submissionAcceptedResponse();
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ status: "pending", message: SUBMISSION_CONFIRMATION_MESSAGE });
  });

  it("never promises a government response or resolution", () => {
    expect(SUBMISSION_CONFIRMATION_MESSAGE).toMatch(/cannot resolve or forward/);
  });
});

describe("invalidRequestResponse", () => {
  it("returns 400 with an optional fieldErrors map", async () => {
    const response = invalidRequestResponse("bad request", { portalId: ["Required"] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "invalid",
      message: "bad request",
      fieldErrors: { portalId: ["Required"] },
    });
  });

  it("omits fieldErrors when not supplied", async () => {
    const response = invalidRequestResponse("bad request");
    expect(await response.json()).toEqual({ status: "invalid", message: "bad request" });
  });
});

describe("forbiddenResponse", () => {
  it("returns 403", () => {
    expect(forbiddenResponse("nope").status).toBe(403);
  });
});

describe("tooLargeResponse", () => {
  it("returns 413", () => {
    expect(tooLargeResponse("too big").status).toBe(413);
  });
});

describe("rateLimitedResponse", () => {
  it("returns 429 with a retryAfterSeconds hint and no abuse-key detail", async () => {
    const response = rateLimitedResponse(3600);
    expect(response.status).toBe(429);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("rate_limited");
    expect(body.retryAfterSeconds).toBe(3600);
    expect(JSON.stringify(body)).not.toMatch(/hash|ip|key/i);
  });
});

describe("serviceUnavailableResponse", () => {
  it("returns 503", () => {
    expect(serviceUnavailableResponse("down").status).toBe(503);
  });
});
