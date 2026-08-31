import { describe, expect, it } from "vitest";
import { canonicalJsonStringify, computeConfigDigest } from "./digest.js";

describe("computeConfigDigest", () => {
  it("produces the same digest regardless of object key order", () => {
    const a = { schemaVersion: "1.0.0", sources: [{ id: "x", url: "https://x.example" }] };
    const b = { sources: [{ url: "https://x.example", id: "x" }], schemaVersion: "1.0.0" };
    expect(computeConfigDigest(a)).toBe(computeConfigDigest(b));
  });

  it("produces the same digest for nested key-order permutations", () => {
    const a = { outer: { b: 2, a: 1, c: { z: 1, y: 2 } } };
    const b = { outer: { c: { y: 2, z: 1 }, a: 1, b: 2 } };
    expect(computeConfigDigest(a)).toBe(computeConfigDigest(b));
  });

  it("produces a different digest when content changes", () => {
    const a = { schemaVersion: "1.0.0", maxPages: 40 };
    const b = { schemaVersion: "1.0.0", maxPages: 41 };
    expect(computeConfigDigest(a)).not.toBe(computeConfigDigest(b));
  });

  it("does not reorder array elements (order is meaningful)", () => {
    const a = { list: [1, 2, 3] };
    const b = { list: [3, 2, 1] };
    expect(computeConfigDigest(a)).not.toBe(computeConfigDigest(b));
  });

  it("is a deterministic 64-character hex sha256 digest", () => {
    const digest = computeConfigDigest({ a: 1 });
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(computeConfigDigest({ a: 1 })).toBe(digest);
  });
});

describe("canonicalJsonStringify", () => {
  it("sorts object keys recursively", () => {
    expect(canonicalJsonStringify({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });
});
