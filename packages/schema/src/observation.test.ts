import { describe, expect, it } from "vitest";
import { linkObservationSchema, pageObservationSchema } from "./observation.js";
import { validLinkObservation, validPageObservation } from "./fixtures/valid.js";

describe("pageObservationSchema", () => {
  it("parses a valid fixture", () => {
    expect(pageObservationSchema.parse(validPageObservation)).toEqual(validPageObservation);
  });

  it("rejects an invalid fetchMode", () => {
    const result = pageObservationSchema.safeParse({ ...validPageObservation, fetchMode: "curl" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["fetchMode"]);
    }
  });

  it("rejects a non-positive attempt", () => {
    const result = pageObservationSchema.safeParse({ ...validPageObservation, attempt: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["attempt"]);
    }
  });
});

describe("linkObservationSchema", () => {
  it("parses a valid fixture", () => {
    expect(linkObservationSchema.parse(validLinkObservation)).toEqual(validLinkObservation);
  });

  it("rejects status 'not_assessable' without an errorCode", () => {
    const result = linkObservationSchema.safeParse({
      ...validLinkObservation,
      status: "not_assessable",
      errorCode: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "errorCode")).toBe(true);
    }
  });

  it("accepts status 'not_assessable' with an errorCode", () => {
    const observation = {
      ...validLinkObservation,
      status: "not_assessable" as const,
      errorCode: "AUTOMATION_BLOCKED",
    };
    expect(linkObservationSchema.parse(observation).status).toBe("not_assessable");
  });

  it("rejects an invalid relationship value", () => {
    const result = linkObservationSchema.safeParse({
      ...validLinkObservation,
      relationship: "sibling",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["relationship"]);
    }
  });
});
