import { taskOutcomeSchema, experienceThemeSchema } from "@panchnama/schema";
import { describe, expect, it } from "vitest";
import {
  DEVICE_TYPE_LABELS,
  EXPERIENCE_THEME_LABELS,
  TASK_OUTCOME_LABELS,
  TASK_TYPE_LABELS,
  type DeviceType,
} from "./experienceLabels";
import { TASK_TYPE_OPTIONS } from "./experienceOptions";

const DEVICE_TYPES: DeviceType[] = ["mobile", "desktop", "tablet", "other"];

describe("TASK_OUTCOME_LABELS", () => {
  it("has a non-empty, non-raw label for every TaskOutcome value", () => {
    for (const value of taskOutcomeSchema.options) {
      const label = TASK_OUTCOME_LABELS[value];
      expect(label).toBeTruthy();
      expect(label).not.toBe(value);
    }
  });

  it("covers exactly the 4 outcome values", () => {
    expect(Object.keys(TASK_OUTCOME_LABELS).sort()).toEqual(
      [...taskOutcomeSchema.options].sort(),
    );
  });
});

describe("EXPERIENCE_THEME_LABELS", () => {
  it("has a non-empty, non-raw label for every ExperienceTheme value", () => {
    for (const value of experienceThemeSchema.options) {
      const label = EXPERIENCE_THEME_LABELS[value];
      expect(label).toBeTruthy();
      expect(label).not.toBe(value);
    }
  });

  it("covers all 13 theme values", () => {
    expect(experienceThemeSchema.options.length).toBe(13);
    expect(Object.keys(EXPERIENCE_THEME_LABELS).sort()).toEqual(
      [...experienceThemeSchema.options].sort(),
    );
  });
});

describe("DEVICE_TYPE_LABELS", () => {
  it("has a non-empty, non-raw label for every device type", () => {
    for (const value of DEVICE_TYPES) {
      const label = DEVICE_TYPE_LABELS[value];
      expect(label).toBeTruthy();
      expect(label).not.toBe(value);
    }
  });
});

describe("TASK_TYPE_LABELS", () => {
  it("has a non-empty, non-raw label for every TASK_TYPE_OPTIONS value", () => {
    for (const value of TASK_TYPE_OPTIONS) {
      const label = TASK_TYPE_LABELS[value];
      expect(label).toBeTruthy();
      expect(label).not.toBe(value);
    }
  });

  it("covers exactly the TASK_TYPE_OPTIONS values", () => {
    expect(Object.keys(TASK_TYPE_LABELS).sort()).toEqual([...TASK_TYPE_OPTIONS].sort());
  });
});
