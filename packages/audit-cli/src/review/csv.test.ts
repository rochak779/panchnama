import { describe, expect, it } from "vitest";
import { buildCsv, csvCell, neutralizeFormulaInjection } from "./csv.js";

describe("neutralizeFormulaInjection", () => {
  it.each(["=cmd|'/c calc'!A1", "+1+1", "-1+1", "@SUM(A1:A2)"])(
    "prefixes formula-injection-prone value %s with a leading single quote",
    (value) => {
      const neutralized = neutralizeFormulaInjection(value);
      expect(neutralized.startsWith("'")).toBe(true);
      expect(neutralized).toBe(`'${value}`);
    },
  );

  it("leaves ordinary values untouched", () => {
    expect(neutralizeFormulaInjection("Ministry of Roads")).toBe("Ministry of Roads");
    expect(neutralizeFormulaInjection("")).toBe("");
  });
});

describe("csvCell", () => {
  it("quotes fields containing commas, quotes, or newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes formula injection before quoting, so the quote stays inside", () => {
    expect(csvCell("=1+1,x")).toBe('"\'=1+1,x"');
  });

  it("renders undefined/null as an empty cell", () => {
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(null)).toBe("");
  });
});

describe("buildCsv", () => {
  it("writes a raw formula-injection assertion on real bytes", () => {
    const csv = buildCsv(
      ["name", "note"],
      [
        ["Portal A", '=HYPERLINK("http://evil")'],
        ["Portal B", "@import(malicious)"],
        ["Portal C", "+1+1"],
        ["Portal D", "-1+1"],
        ["Portal E", "normal text"],
      ],
    );
    // The raw output must never contain a bare, unescaped leading formula
    // trigger character right after a field-starting comma or line start —
    // every dangerous cell must carry the neutralizing leading quote.
    expect(csv).toContain('"\'=HYPERLINK(""http://evil"")"');
    expect(csv).toContain("'@import(malicious)");
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'-1+1");
    expect(csv).toContain("Portal E,normal text");
    // No raw, un-neutralized formula-trigger cell start should appear.
    expect(csv).not.toMatch(/,=HYPERLINK/);
    expect(csv).not.toMatch(/,@import/);
  });

  it("uses CRLF line endings and a trailing newline", () => {
    const csv = buildCsv(["a"], [["1"], ["2"]]);
    expect(csv).toBe("a\r\n1\r\n2\r\n");
  });
});
