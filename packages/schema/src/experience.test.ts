import { describe, expect, it } from "vitest";
import { experienceSubmissionSchema, portalExperienceSummarySchema } from "./experience.js";
import { validExperienceSubmission, validPortalExperienceSummary } from "./fixtures/valid.js";

describe("experienceSubmissionSchema", () => {
  it("parses a valid fixture", () => {
    expect(experienceSubmissionSchema.parse(validExperienceSubmission)).toEqual(
      validExperienceSubmission,
    );
  });

  it("rejects freeText over 1000 characters", () => {
    const result = experienceSubmissionSchema.safeParse({
      ...validExperienceSubmission,
      freeText: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["freeText"]);
    }
  });

  it("rejects taskDescription over 280 characters", () => {
    const result = experienceSubmissionSchema.safeParse({
      ...validExperienceSubmission,
      taskDescription: "a".repeat(281),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["taskDescription"]);
    }
  });

  it("rejects an experienceRating outside 1-5", () => {
    const result = experienceSubmissionSchema.safeParse({
      ...validExperienceSubmission,
      experienceRating: 6,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["experienceRating"]);
    }
  });

  it("rejects a PII-shaped field being smuggled in as an unknown key (strict)", () => {
    const result = experienceSubmissionSchema.safeParse({
      ...validExperienceSubmission,
      phoneNumber: "9876543210",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
    }
  });

  it("rejects an invalid ExperienceTheme in themes[]", () => {
    const result = experienceSubmissionSchema.safeParse({
      ...validExperienceSubmission,
      themes: ["availability", "not_a_theme"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "themes.1")).toBe(true);
    }
  });
});

describe("portalExperienceSummarySchema", () => {
  it("parses a valid fixture", () => {
    expect(portalExperienceSummarySchema.parse(validPortalExperienceSummary)).toEqual(
      validPortalExperienceSummary,
    );
  });

  it("rejects an averageRating outside 1-5", () => {
    const result = portalExperienceSummarySchema.safeParse({
      ...validPortalExperienceSummary,
      averageRating: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["averageRating"]);
    }
  });

  it("rejects a negative approvedExperienceCount", () => {
    const result = portalExperienceSummarySchema.safeParse({
      ...validPortalExperienceSummary,
      approvedExperienceCount: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["approvedExperienceCount"]);
    }
  });
});
