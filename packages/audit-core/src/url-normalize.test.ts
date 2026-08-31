import { describe, expect, it } from "vitest";
import { DEFAULT_URL_NORMALIZATION_OPTIONS, normalizeUrl } from "./url-normalize.js";

describe("normalizeUrl", () => {
  it("lowercases scheme and hostname", () => {
    const result = normalizeUrl("HTTPS://Assam.Gov.Example/Path");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedUrl).toBe("https://assam.gov.example/Path");
    }
  });

  it("removes default ports", () => {
    expect(normalizeUrl("http://host.example:80/a")).toMatchObject({
      ok: true,
      normalizedUrl: "http://host.example/a",
    });
    expect(normalizeUrl("https://host.example:443/a")).toMatchObject({
      ok: true,
      normalizedUrl: "https://host.example/a",
    });
    // non-default port is preserved
    expect(normalizeUrl("https://host.example:8443/a")).toMatchObject({
      ok: true,
      normalizedUrl: "https://host.example:8443/a",
    });
  });

  it("removes fragments", () => {
    const result = normalizeUrl("https://host.example/page#section-2");
    expect(result).toMatchObject({ ok: true, normalizedUrl: "https://host.example/page" });
  });

  it("resolves relative URLs against a base", () => {
    const result = normalizeUrl(
      "/schemes/pension",
      DEFAULT_URL_NORMALIZATION_OPTIONS,
      "https://assam.gov.example/home",
    );
    expect(result).toMatchObject({
      ok: true,
      originalUrl: "/schemes/pension",
      normalizedUrl: "https://assam.gov.example/schemes/pension",
    });
  });

  it("resolves a relative URL with dot-segments against a base", () => {
    const result = normalizeUrl(
      "../portal/",
      DEFAULT_URL_NORMALIZATION_OPTIONS,
      "https://assam.gov.example/districts/here",
    );
    expect(result).toMatchObject({ ok: true, normalizedUrl: "https://assam.gov.example/portal" });
  });

  it("strips trailing slashes except the root path", () => {
    expect(normalizeUrl("https://host.example/foo/")).toMatchObject({
      ok: true,
      normalizedUrl: "https://host.example/foo",
    });
    expect(normalizeUrl("https://host.example/")).toMatchObject({
      ok: true,
      normalizedUrl: "https://host.example/",
    });
  });

  it("preserves trailing slashes when policy is 'preserve'", () => {
    const result = normalizeUrl("https://host.example/foo/", {
      ...DEFAULT_URL_NORMALIZATION_OPTIONS,
      trailingSlashPolicy: "preserve",
    });
    expect(result).toMatchObject({ ok: true, normalizedUrl: "https://host.example/foo/" });
  });

  it("removes known tracking parameters and sorts retained ones", () => {
    const result = normalizeUrl(
      "https://host.example/page?utm_source=x&b=2&a=1&gclid=abc",
      DEFAULT_URL_NORMALIZATION_OPTIONS,
    );
    expect(result).toMatchObject({ ok: true, normalizedUrl: "https://host.example/page?a=1&b=2" });
  });

  it("does not merge http and https variants of the same host/path (conservative identity decision)", () => {
    const httpResult = normalizeUrl("http://host.example/path");
    const httpsResult = normalizeUrl("https://host.example/path");
    expect(httpResult.ok && httpsResult.ok).toBe(true);
    if (httpResult.ok && httpsResult.ok) {
      expect(httpResult.normalizedUrl).not.toBe(httpsResult.normalizedUrl);
    }
  });

  it("preserves the originally observed URL alongside the normalized URL", () => {
    const raw = "HTTPS://Host.Example:443/Foo/?utm_source=x&b=2&a=1#frag";
    const result = normalizeUrl(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.originalUrl).toBe(raw);
      expect(result.normalizedUrl).toBe("https://host.example/Foo?a=1&b=2");
    }
  });

  it("rejects malformed URLs instead of silently dropping or including them", () => {
    const result = normalizeUrl("ht!tp://bad url with spaces");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBeTruthy();
      expect(result.originalUrl).toBe("ht!tp://bad url with spaces");
    }
  });

  it("rejects non-http(s) schemes", () => {
    expect(normalizeUrl("mailto:someone@example.com").ok).toBe(false);
    expect(normalizeUrl("javascript:void(0)").ok).toBe(false);
    expect(normalizeUrl("tel:+911234567890").ok).toBe(false);
  });

  it("rejects an empty URL", () => {
    expect(normalizeUrl("   ").ok).toBe(false);
  });

  it("rejects a relative URL with no base to resolve against", () => {
    expect(normalizeUrl("/no-base-provided").ok).toBe(false);
  });
});
