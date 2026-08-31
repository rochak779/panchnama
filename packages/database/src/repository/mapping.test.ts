import { describe, expect, it } from "vitest";
import { experienceSubmissionSchema } from "@panchnama/schema";
import { toExperienceSubmission } from "./mapping.js";
import type { ExperienceSubmissionRow } from "../schema/submissions.js";
import type { ExperienceModerationRow } from "../schema/moderation.js";

const baseSubmission: ExperienceSubmissionRow = {
  id: "11111111-1111-4111-8111-111111111111",
  schemaVersion: "1.0.0",
  portalId: "portal-agri-assam",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  occurredOn: null,
  taskType: "general_information",
  taskDescription: null,
  outcome: "completed",
  themes: ["navigation"],
  deviceType: null,
  experienceRating: null,
  freeText: null,
  consentToPublish: true,
  source: "public_form",
  privacyFlags: [],
  duplicateOf: null,
  seedKey: null,
};

describe("toExperienceSubmission", () => {
  it("round-trips a pending submission (no moderation row yet) into a schema-valid record", () => {
    const mapped = toExperienceSubmission(baseSubmission, null);
    expect(mapped.status).toBe("pending");
    expect(() => experienceSubmissionSchema.parse(mapped)).not.toThrow();
  });

  it("round-trips a fully-populated, moderated submission into a schema-valid record", () => {
    const submission: ExperienceSubmissionRow = {
      ...baseSubmission,
      occurredOn: "2026-08",
      taskDescription: "Tried to renew a license.",
      deviceType: "mobile",
      experienceRating: 4,
      freeText: "It mostly worked.",
      duplicateOf: null,
    };
    const moderation: ExperienceModerationRow = {
      id: "22222222-2222-4222-8222-222222222222",
      submissionId: submission.id,
      status: "approved",
      moderatedAt: new Date("2026-08-02T00:00:00.000Z"),
      moderationReasonCode: "approved_relevant",
      publicText: "It mostly worked.",
      updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    };

    const mapped = toExperienceSubmission(submission, moderation);
    expect(mapped.status).toBe("approved");
    expect(mapped.publicText).toBe("It mostly worked.");
    expect(mapped.freeText).toBe("It mostly worked.");
    const parsed = experienceSubmissionSchema.parse(mapped);
    expect(parsed.moderationReasonCode).toBe("approved_relevant");
  });

  it("never sets an optional field to undefined explicitly (exactOptionalPropertyTypes safety)", () => {
    const mapped = toExperienceSubmission(baseSubmission, null);
    expect(Object.prototype.hasOwnProperty.call(mapped, "occurredOn")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(mapped, "freeText")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(mapped, "publicText")).toBe(false);
  });
});
