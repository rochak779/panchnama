import { describe, expect, it } from "vitest";
import { extractHtml } from "./html-extract.js";

describe("extractHtml", () => {
  it("extracts title, canonical, and language", () => {
    const html = `<!doctype html><html lang="en-IN"><head>
      <title>  Department of Testing  </title>
      <link rel="canonical" href="/canonical-page">
    </head><body><a href="/a">A</a></body></html>`;
    const result = extractHtml(html, "https://portal.example/page");
    expect(result.title).toBe("Department of Testing");
    expect(result.canonical).toBe("https://portal.example/canonical-page");
    expect(result.language).toBe("en-IN");
  });

  it("falls back to content-language meta tag when <html lang> is absent", () => {
    const html = `<html><head><meta http-equiv="Content-Language" content="hi"></head><body></body></html>`;
    const result = extractHtml(html, "https://portal.example/");
    expect(result.language).toBe("hi");
  });

  it("does not crash on malformed HTML (unclosed tags, missing quotes, stray <)", () => {
    const html = `<html><body><p>Unclosed <a href=/a>link text<div class=foo>stray < bracket</body>`;
    expect(() => extractHtml(html, "https://portal.example/")).not.toThrow();
    const result = extractHtml(html, "https://portal.example/");
    expect(result.links.length).toBeGreaterThan(0);
    expect(result.links[0]?.resolvedUrl).toBe("https://portal.example/a");
  });

  it("resolves relative links against the page URL when no <base> is present", () => {
    const html = `<a href="child">Child</a><a href="../parent">Parent</a>`;
    const result = extractHtml(html, "https://portal.example/dir/page.html");
    expect(result.links.map((l) => l.resolvedUrl)).toEqual([
      "https://portal.example/dir/child",
      "https://portal.example/parent",
    ]);
  });

  it("resolves relative links against <base href> when present", () => {
    const html = `<base href="https://other.example/base/"><a href="child">Child</a>`;
    const result = extractHtml(html, "https://portal.example/dir/page.html");
    expect(result.links[0]?.resolvedUrl).toBe("https://other.example/base/child");
  });

  it("resolves canonical against <base href> too", () => {
    const html = `<base href="https://other.example/base/"><link rel="canonical" href="c">`;
    const result = extractHtml(html, "https://portal.example/dir/page.html");
    expect(result.canonical).toBe("https://other.example/base/c");
  });

  it("resolves encoded URLs (percent-encoding and HTML entities) correctly", () => {
    const html = `<a href="/search?q=a&amp;b=c%20d">Encoded</a>`;
    const result = extractHtml(html, "https://portal.example/");
    // Cheerio decodes the &amp; entity to a literal & when parsing the
    // attribute value; percent-encoding is preserved as-is by URL().
    expect(result.links[0]?.resolvedUrl).toBe("https://portal.example/search?q=a&b=c%20d");
  });

  it("captures anchor text and a bounded context string", () => {
    const html = `<p>Please see the <a href="/details">official notice</a> for more.</p>`;
    const result = extractHtml(html, "https://portal.example/");
    expect(result.links[0]?.anchorText).toBe("official notice");
    expect(result.links[0]?.context).toContain("official notice");
    expect(result.links[0]?.context).toContain("Please see the");
  });

  it("skips anchors with empty href, and reports resolvedUrl undefined only for genuinely unparseable hrefs", () => {
    const html = `<a href="">Empty</a><a href="   ">Blank</a><a href="https://ok.example/">OK</a>`;
    const result = extractHtml(html, "https://portal.example/");
    expect(result.links.length).toBe(1);
    expect(result.links[0]?.resolvedUrl).toBe("https://ok.example/");
  });
});
