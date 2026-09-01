import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./originCheck";

function request(headers: Record<string, string>): Request {
  return new Request("https://panchnama.example/api/experiences", {
    method: "POST",
    headers,
  });
}

describe("isSameOriginRequest", () => {
  it("accepts a request whose Origin host matches the Host header", () => {
    expect(
      isSameOriginRequest(
        request({ host: "panchnama.example", origin: "https://panchnama.example" }),
      ),
    ).toBe(true);
  });

  it("rejects a request whose Origin host does not match the Host header", () => {
    expect(
      isSameOriginRequest(
        request({ host: "panchnama.example", origin: "https://attacker.example" }),
      ),
    ).toBe(false);
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(
      isSameOriginRequest(
        request({ host: "panchnama.example", referer: "https://panchnama.example/form" }),
      ),
    ).toBe(true);
  });

  it("rejects when Referer host does not match Host", () => {
    expect(
      isSameOriginRequest(
        request({ host: "panchnama.example", referer: "https://attacker.example/form" }),
      ),
    ).toBe(false);
  });

  it("rejects when neither Origin nor Referer is present", () => {
    expect(isSameOriginRequest(request({ host: "panchnama.example" }))).toBe(false);
  });

  it("rejects when Host is missing entirely", () => {
    expect(isSameOriginRequest(request({ origin: "https://panchnama.example" }))).toBe(false);
  });

  it("rejects a malformed Origin header instead of throwing", () => {
    expect(isSameOriginRequest(request({ host: "panchnama.example", origin: "not-a-url" }))).toBe(
      false,
    );
  });
});
