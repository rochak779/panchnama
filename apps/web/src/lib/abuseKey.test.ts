import { describe, expect, it } from "vitest";
import { computeAbuseKeyHash, extractClientIp } from "./abuseKey";

function request(headers: Record<string, string>): Request {
  return new Request("https://panchnama.example/api/experiences", { headers });
}

describe("extractClientIp", () => {
  it("reads the first address from x-forwarded-for", () => {
    expect(extractClientIp(request({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe(
      "203.0.113.5",
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(extractClientIp(request({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("returns null when neither header is present", () => {
    expect(extractClientIp(request({}))).toBeNull();
  });
});

describe("computeAbuseKeyHash", () => {
  it("is deterministic for the same secret and ip", () => {
    const a = computeAbuseKeyHash("secret", "203.0.113.5");
    const b = computeAbuseKeyHash("secret", "203.0.113.5");
    expect(a).toBe(b);
  });

  it("never leaks the raw ip in the output", () => {
    const hash = computeAbuseKeyHash("secret", "203.0.113.5");
    expect(hash).not.toContain("203.0.113.5");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different ips under the same secret", () => {
    expect(computeAbuseKeyHash("secret", "203.0.113.5")).not.toBe(
      computeAbuseKeyHash("secret", "203.0.113.6"),
    );
  });

  it("differs for different secrets under the same ip", () => {
    expect(computeAbuseKeyHash("secret-a", "203.0.113.5")).not.toBe(
      computeAbuseKeyHash("secret-b", "203.0.113.5"),
    );
  });

  it("buckets every IP-less request into one fixed, shared key", () => {
    expect(computeAbuseKeyHash("secret", null)).toBe(computeAbuseKeyHash("secret", null));
  });
});
