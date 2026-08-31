import { describe, expect, it } from "vitest";
import { evidenceArtifactSchema } from "./evidence.js";
import { validEvidenceArtifactReviewed } from "./fixtures/valid.js";

describe("evidenceArtifactSchema", () => {
  it("parses a valid fixture", () => {
    expect(evidenceArtifactSchema.parse(validEvidenceArtifactReviewed)).toEqual(
      validEvidenceArtifactReviewed,
    );
  });

  it("allows privacyReviewed: false (not yet reviewed, still a valid stored record)", () => {
    const unreviewed = { ...validEvidenceArtifactReviewed, privacyReviewed: false };
    expect(evidenceArtifactSchema.parse(unreviewed).privacyReviewed).toBe(false);
  });

  it("rejects an invalid EvidenceType", () => {
    const result = evidenceArtifactSchema.safeParse({
      ...validEvidenceArtifactReviewed,
      type: "video_recording",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["type"]);
    }
  });

  it("rejects a missing description", () => {
    const { description: _description, ...rest } = validEvidenceArtifactReviewed;
    const result = evidenceArtifactSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "description")).toBe(true);
    }
  });
});
