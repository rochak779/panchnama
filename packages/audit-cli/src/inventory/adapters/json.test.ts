import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseJsonSeed } from "./json.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const fixturePath = join(repoRoot, "data", "seed", "assam-directory-example.json");

const context = {
  sourceId: "assam-online-services",
  discoveredFromUrl: "https://online.assam.gov.in",
  discoveryMethod: "listed" as const,
};

describe("parseJsonSeed", () => {
  it("parses entries from the real fixture, including optional fields", () => {
    const json = readFileSync(fixturePath, "utf8");
    const result = parseJsonSeed(json, context);

    const onlineServices = result.candidates.find((c) => c.name === "Assam Online Services");
    expect(onlineServices).toMatchObject({
      url: "https://online.assam.gov.example",
      department: "Directorate of Information Technology",
      portalType: "transactional",
      tags: ["citizen-services"],
      sourceId: "assam-online-services",
      discoveryMethod: "listed",
    });
  });

  it("rejects an entry with a non-http(s) scheme URL only at normalization time, not here (adapter passes it through)", () => {
    const json = readFileSync(fixturePath, "utf8");
    const result = parseJsonSeed(json, context);
    const broken = result.candidates.find((c) => c.name === "Entirely broken entry");
    expect(broken?.url).toBe("javascript:alert(1)");
  });

  it("accepts a bare top-level array as well as an { entries } object", () => {
    const result = parseJsonSeed(
      JSON.stringify([{ name: "A", url: "https://a.example" }]),
      context,
    );
    expect(result.candidates).toHaveLength(1);
  });

  it("rejects entries missing name or url instead of silently dropping them", () => {
    const result = parseJsonSeed(
      JSON.stringify({
        entries: [{ name: "No URL here" }, { url: "https://no-name.example" }],
      }),
      context,
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
  });

  it("reports invalid JSON as rejected, not a thrown exception", () => {
    const result = parseJsonSeed("{not valid json", context);
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("invalid JSON");
  });

  it("rejects a top-level shape that is neither an array nor an { entries } object", () => {
    const result = parseJsonSeed(JSON.stringify({ foo: "bar" }), context);
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });
});
