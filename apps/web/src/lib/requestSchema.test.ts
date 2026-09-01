import { describe, expect, it } from "vitest";
import { experienceRequestSchema, HONEYPOT_FIELD_NAME } from "./requestSchema";

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    portalId: "portal-agri-assam",
    taskType: "find_information",
    outcome: "completed",
    themes: ["navigation"],
    consentToPublish: true,
    ...overrides,
  };
}

describe("experienceRequestSchema", () => {
  it("accepts a minimal valid submission", () => {
    expect(experienceRequestSchema.safeParse(validBody()).success).toBe(true);
  });

  it("accepts a fully populated valid submission", () => {
    const result = experienceRequestSchema.safeParse(
      validBody({
        occurredOn: "2026-08",
        taskDescription: "Applied for a pension scheme",
        deviceType: "mobile",
        experienceRating: 4,
        freeText: "Took a while to find the form but it worked.",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a taskType outside the controlled vocabulary", () => {
    const result = experienceRequestSchema.safeParse(validBody({ taskType: "not_a_real_type" }));
    expect(result.success).toBe(false);
  });

  it("rejects taskDescription over 280 characters", () => {
    const result = experienceRequestSchema.safeParse(
      validBody({ taskDescription: "a".repeat(281) }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects freeText over 1000 characters", () => {
    const result = experienceRequestSchema.safeParse(validBody({ freeText: "a".repeat(1001) }));
    expect(result.success).toBe(false);
  });

  it("rejects an experienceRating outside 1-5", () => {
    expect(experienceRequestSchema.safeParse(validBody({ experienceRating: 0 })).success).toBe(
      false,
    );
    expect(experienceRequestSchema.safeParse(validBody({ experienceRating: 6 })).success).toBe(
      false,
    );
  });

  it("rejects an unknown theme value", () => {
    const result = experienceRequestSchema.safeParse(validBody({ themes: ["not_a_theme"] }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing consentToPublish", () => {
    const body = validBody();
    delete body.consentToPublish;
    expect(experienceRequestSchema.safeParse(body).success).toBe(false);
  });

  it("rejects server-assigned fields a client should never be able to set", () => {
    for (const field of ["id", "status", "publicText", "privacyFlags", "duplicateOf", "source"]) {
      const result = experienceRequestSchema.safeParse(validBody({ [field]: "anything" }));
      expect(result.success, `expected ${field} to be rejected`).toBe(false);
    }
  });

  it("rejects any unrecognized extra field (.strict())", () => {
    const result = experienceRequestSchema.safeParse(validBody({ extraField: "smuggled" }));
    expect(result.success).toBe(false);
  });

  it("accepts an absent or empty honeypot field", () => {
    expect(experienceRequestSchema.safeParse(validBody()).success).toBe(true);
    expect(
      experienceRequestSchema.safeParse(validBody({ [HONEYPOT_FIELD_NAME]: "" })).success,
    ).toBe(true);
  });

  it("accepts (but does not require) a filled honeypot field at the schema layer", () => {
    // Rejection of a filled honeypot is the submission handler's job, not
    // the schema's — the schema only bounds its shape/length.
    expect(
      experienceRequestSchema.safeParse(validBody({ [HONEYPOT_FIELD_NAME]: "spambot inc" }))
        .success,
    ).toBe(true);
  });
});
