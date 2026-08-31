import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.js";

describe("parseCsv", () => {
  it("parses a simple header + rows", () => {
    const rows = parseCsv("name,url\nAlpha,https://alpha.example\nBeta,https://beta.example\n");
    expect(rows).toEqual([
      ["name", "url"],
      ["Alpha", "https://alpha.example"],
      ["Beta", "https://beta.example"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    const rows = parseCsv('name,notes\n"Alpha","has, a comma"\n');
    expect(rows).toEqual([
      ["name", "notes"],
      ["Alpha", "has, a comma"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    const rows = parseCsv('name,notes\n"Alpha","she said ""hi"""\n');
    expect(rows[1]).toEqual(["Alpha", 'she said "hi"']);
  });

  it("handles CRLF line endings", () => {
    const rows = parseCsv("name,url\r\nAlpha,https://alpha.example\r\n");
    expect(rows).toEqual([
      ["name", "url"],
      ["Alpha", "https://alpha.example"],
    ]);
  });

  it("handles empty trailing fields", () => {
    const rows = parseCsv("name,url,notes\nAlpha,https://alpha.example,\n");
    expect(rows[1]).toEqual(["Alpha", "https://alpha.example", ""]);
  });

  it("handles a file with no trailing newline", () => {
    const rows = parseCsv("name,url\nAlpha,https://alpha.example");
    expect(rows).toEqual([
      ["name", "url"],
      ["Alpha", "https://alpha.example"],
    ]);
  });

  it("ignores blank lines", () => {
    const rows = parseCsv("name,url\n\nAlpha,https://alpha.example\n");
    expect(rows).toEqual([
      ["name", "url"],
      ["Alpha", "https://alpha.example"],
    ]);
  });
});
