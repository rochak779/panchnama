import { describe, expect, it } from "vitest";
import { detectPrivacyFlags } from "./privacyFlags";

describe("detectPrivacyFlags", () => {
  it("returns an empty array for empty/absent text", () => {
    expect(detectPrivacyFlags(null)).toEqual([]);
    expect(detectPrivacyFlags(undefined)).toEqual([]);
    expect(detectPrivacyFlags("")).toEqual([]);
  });

  it("returns an empty array for text with no matches", () => {
    expect(detectPrivacyFlags("I could not find the pension form on the site.")).toEqual([]);
  });

  it("flags an email address", () => {
    expect(detectPrivacyFlags("contact me at citizen.name@example.com please")).toContain(
      "possible_email",
    );
  });

  it("flags an Indian mobile number in plain and formatted forms", () => {
    expect(detectPrivacyFlags("call 9876543210 tomorrow")).toContain(
      "possible_indian_mobile_number",
    );
    expect(detectPrivacyFlags("call +91 98765 43210 tomorrow")).toContain(
      "possible_indian_mobile_number",
    );
    // A number not starting 6-9 should not match this pattern.
    expect(detectPrivacyFlags("call 5876543210 tomorrow")).not.toContain(
      "possible_indian_mobile_number",
    );
  });

  it("flags an Aadhaar-shaped 12-digit sequence", () => {
    expect(detectPrivacyFlags("my aadhaar is 1234 5678 9012")).toContain("possible_aadhaar_number");
    expect(detectPrivacyFlags("my aadhaar is 123456789012")).toContain("possible_aadhaar_number");
  });

  it("flags a PAN-shaped sequence with word boundaries", () => {
    expect(detectPrivacyFlags("PAN: ABCDE1234F")).toContain("possible_pan_number");
    expect(detectPrivacyFlags("XABCDE1234FX")).not.toContain("possible_pan_number");
  });

  it("flags other long digit runs (8+) as a generic reference number", () => {
    expect(detectPrivacyFlags("my reference is 12345678")).toContain(
      "possible_long_reference_number",
    );
  });

  it("returns distinct flags, not duplicates, across repeated matches", () => {
    const flags = detectPrivacyFlags("email a@b.com and also c@d.com");
    expect(flags.filter((f) => f === "possible_email")).toHaveLength(1);
  });

  it("can return multiple distinct flags for one string", () => {
    const flags = detectPrivacyFlags("email a@b.com, aadhaar 123456789012");
    expect(flags).toContain("possible_email");
    expect(flags).toContain("possible_aadhaar_number");
  });

  it("is safe to call repeatedly without stateful regex leakage (global-flag lastIndex reset)", () => {
    // A regression test for the documented lastIndex-reset discipline: two
    // consecutive calls against the same-shaped input must both match.
    expect(detectPrivacyFlags("a@b.com")).toContain("possible_email");
    expect(detectPrivacyFlags("a@b.com")).toContain("possible_email");
  });
});
