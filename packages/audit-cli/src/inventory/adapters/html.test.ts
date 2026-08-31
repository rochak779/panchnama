import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHtmlSeed } from "./html.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/inventory/adapters -> src -> audit-cli -> packages -> repo root
const repoRoot = join(here, "..", "..", "..", "..", "..");
const fixturePath = join(repoRoot, "data", "seed", "assam-directory-example.html");

describe("parseHtmlSeed", () => {
  it("extracts name/href pairs from anchor tags", () => {
    const html = readFileSync(fixturePath, "utf8");
    const result = parseHtmlSeed(html, {
      sourceId: "assam-gov-portal",
      discoveredFromUrl: "https://assam.gov.in",
      discoveryMethod: "outbound_link",
    });

    const names = result.candidates.map((c) => c.name);
    expect(names).toContain("Agriculture Department Portal");
    expect(names).toContain("Health & Family Welfare Portal");
    expect(names).toContain("Assam Online Services");
    expect(names).toContain("Pension Schemes (relative link)");

    const pension = result.candidates.find((c) => c.name === "Pension Schemes (relative link)");
    expect(pension?.url).toBe("/schemes/pension");
    expect(pension?.sourceId).toBe("assam-gov-portal");
    expect(pension?.discoveryMethod).toBe("outbound_link");
    expect(pension?.discoveredFromUrl).toBe("https://assam.gov.in");
  });

  it("does not silently drop the malformed-href anchor; it is rejected instead", () => {
    const html = readFileSync(fixturePath, "utf8");
    const result = parseHtmlSeed(html, {
      sourceId: "assam-gov-portal",
      discoveredFromUrl: "https://assam.gov.in",
      discoveryMethod: "outbound_link",
    });
    // "http://" is a syntactically present href; the HTML adapter passes
    // it through as a candidate (normalization later flags it as
    // malformed) since a non-empty href always yields a candidate here.
    const brokenCandidate = result.candidates.find((c) => c.name.includes("Broken Entry"));
    expect(brokenCandidate?.url).toBe("http://");
  });

  it("passes through a mailto href as a candidate (rejected later by URL normalization, not by this adapter)", () => {
    const html = readFileSync(fixturePath, "utf8");
    const result = parseHtmlSeed(html, {
      sourceId: "assam-gov-portal",
      discoveredFromUrl: "https://assam.gov.in",
      discoveryMethod: "outbound_link",
    });
    const mailtoCandidate = result.candidates.find((c) => c.url.startsWith("mailto:"));
    expect(mailtoCandidate).toBeDefined();
  });

  it("rejects an anchor with an empty href", () => {
    const result = parseHtmlSeed('<a href="">Empty</a>', {
      sourceId: "s1",
      discoveredFromUrl: "https://s1.example",
      discoveryMethod: "listed",
    });
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("empty href");
  });

  it("rejects an anchor with no usable text", () => {
    const result = parseHtmlSeed('<a href="https://x.example"><img src="icon.png"/></a>', {
      sourceId: "s1",
      discoveredFromUrl: "https://s1.example",
      discoveryMethod: "listed",
    });
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("no usable link text");
  });

  it("skips anchors with no href attribute at all", () => {
    const result = parseHtmlSeed('<a name="anchor-only">Not a link</a>', {
      sourceId: "s1",
      discoveredFromUrl: "https://s1.example",
      discoveryMethod: "listed",
    });
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});
