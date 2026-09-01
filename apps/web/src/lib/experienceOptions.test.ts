import { describe, expect, it } from "vitest";
import { EXPERIENCE_THEME_VALUES } from "@panchnama/database";
import { isKnownTaskType, TASK_TYPE_OPTIONS, THEME_OPTIONS } from "./experienceOptions";

describe("TASK_TYPE_OPTIONS", () => {
  it("includes an 'other' escape hatch", () => {
    expect(TASK_TYPE_OPTIONS).toContain("other");
  });

  it("has no duplicate values", () => {
    expect(new Set(TASK_TYPE_OPTIONS).size).toBe(TASK_TYPE_OPTIONS.length);
  });
});

describe("isKnownTaskType", () => {
  it("accepts every declared option", () => {
    for (const option of TASK_TYPE_OPTIONS) {
      expect(isKnownTaskType(option)).toBe(true);
    }
  });

  it("rejects an arbitrary string", () => {
    expect(isKnownTaskType("not_a_real_task_type")).toBe(false);
  });
});

describe("THEME_OPTIONS", () => {
  it("reuses @panchnama/database's EXPERIENCE_THEME_VALUES exactly (single source of truth)", () => {
    expect(THEME_OPTIONS).toBe(EXPERIENCE_THEME_VALUES);
  });
});
