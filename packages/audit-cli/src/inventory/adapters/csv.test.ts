import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCsvSeed } from "./csv.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const fixturePath = join(repoRoot, "data", "seed", "assam-directory-example.csv");

const context = {
  sourceId: "assam-district-portal-directory",
  discoveredFromUrl: "https://assam.gov.in/districts",
  discoveryMethod: "listed" as const,
};

describe("parseCsvSeed", () => {
  it("parses rows from the real fixture, including department/notes", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseCsvSeed(csv, context);

    const kamrup = result.candidates.find((c) => c.name === "Kamrup District Administration");
    expect(kamrup).toMatchObject({
      url: "https://kamrup.assam.gov.example",
      department: "District Administration",
      notes: "Illustrative fixture entry",
      sourceId: "assam-district-portal-directory",
      discoveryMethod: "listed",
    });
  });

  it("passes the malformed URL row through as a candidate (normalization rejects it later)", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseCsvSeed(csv, context);
    const broken = result.candidates.find((c) => c.name === "Broken Row");
    expect(broken?.url).toBe("ht!tp://bad url with spaces");
  });

  it("rejects rows missing a name or url", () => {
    const csv = "name,url\n,https://x.example\nHas Name,\n";
    const result = parseCsvSeed(csv, context);
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
  });

  it("rejects a CSV with no recognizable header", () => {
    const csv = "foo,bar\n1,2\n";
    const result = parseCsvSeed(csv, context);
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("required");
  });

  it("returns nothing for an empty file", () => {
    const result = parseCsvSeed("", context);
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it("is header-order-independent", () => {
    const csv = "url,name,department\nhttps://x.example,X Portal,Dept X\n";
    const result = parseCsvSeed(csv, context);
    expect(result.candidates).toEqual([
      expect.objectContaining({ name: "X Portal", url: "https://x.example", department: "Dept X" }),
    ]);
  });
});
