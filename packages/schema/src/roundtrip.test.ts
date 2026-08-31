import { describe, expect, it } from "vitest";
import { findingSchema } from "./finding.js";
import { portalSchema } from "./portal.js";
import { portalOverlapComparisonSchema } from "./overlap.js";
import { experienceSubmissionSchema } from "./experience.js";
import {
  validExperienceSubmission,
  validFindingOverlap,
  validPortalA,
  validPortalOverlapComparison,
} from "./fixtures/valid.js";

/**
 * `JSON.parse(JSON.stringify(parsed))` round trips for the more complex
 * entities, per the Session 1 task description. This is the shape data
 * actually takes once it is written to `data/*.json` and read back by a
 * later pipeline stage or the frontend, so it's worth checking independent
 * of the direct `.parse()` tests above.
 */
describe("JSON round trips", () => {
  it("Finding survives a JSON round trip", () => {
    const parsed = findingSchema.parse(validFindingOverlap);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as unknown;
    expect(findingSchema.parse(roundTripped)).toEqual(parsed);
  });

  it("Portal survives a JSON round trip", () => {
    const parsed = portalSchema.parse(validPortalA);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as unknown;
    expect(portalSchema.parse(roundTripped)).toEqual(parsed);
  });

  it("PortalOverlapComparison survives a JSON round trip", () => {
    const parsed = portalOverlapComparisonSchema.parse(validPortalOverlapComparison);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as unknown;
    expect(portalOverlapComparisonSchema.parse(roundTripped)).toEqual(parsed);
  });

  it("ExperienceSubmission survives a JSON round trip", () => {
    const parsed = experienceSubmissionSchema.parse(validExperienceSubmission);
    const roundTripped = JSON.parse(JSON.stringify(parsed)) as unknown;
    expect(experienceSubmissionSchema.parse(roundTripped)).toEqual(parsed);
  });
});
