import { describe, expect, it } from "vitest";
import { extractRawHrefs } from "./link-scan.js";

describe("extractRawHrefs", () => {
  it("extracts double- and single-quoted hrefs", () => {
    const html = `<a href="/foo">Foo</a><a href='/bar'>Bar</a>`;
    expect(extractRawHrefs(html)).toEqual(["/foo", "/bar"]);
  });

  it("extracts unquoted hrefs", () => {
    const html = `<a href=/foo class=x>Foo</a>`;
    expect(extractRawHrefs(html)).toEqual(["/foo"]);
  });

  it("ignores anchors without href", () => {
    const html = `<a name="top">Top</a><a href="/ok">Ok</a>`;
    expect(extractRawHrefs(html)).toEqual(["/ok"]);
  });

  it("returns duplicates in document order", () => {
    const html = `<a href="/x">1</a><a href="/x">2</a>`;
    expect(extractRawHrefs(html)).toEqual(["/x", "/x"]);
  });

  it("handles malformed HTML without throwing", () => {
    expect(() => extractRawHrefs("<a href='unterminated")).not.toThrow();
  });

  it("returns empty array for no anchors", () => {
    expect(extractRawHrefs("<p>no links here</p>")).toEqual([]);
  });
});
