import { describe, expect, it } from "vitest";
import {
  CONSENT_TO_PUBLISH_COPY,
  MODERATION_DISCLAIMER_COPY,
  NOT_A_GRIEVANCE_CHANNEL_COPY,
  PRIVACY_WARNING_COPY,
  REMOVAL_CONTACT_COPY,
} from "./experienceCopy";

const ALL_COPY = {
  PRIVACY_WARNING_COPY,
  NOT_A_GRIEVANCE_CHANNEL_COPY,
  CONSENT_TO_PUBLISH_COPY,
  MODERATION_DISCLAIMER_COPY,
  REMOVAL_CONTACT_COPY,
};

describe("experienceCopy", () => {
  it("every export is a non-empty string", () => {
    for (const [name, value] of Object.entries(ALL_COPY)) {
      expect(typeof value, `${name} should be a string`).toBe("string");
      expect(value.trim().length, `${name} should not be empty`).toBeGreaterThan(0);
    }
  });

  it("PRIVACY_WARNING_COPY warns against personal information fields", () => {
    expect(PRIVACY_WARNING_COPY).toMatch(/personal information/i);
    expect(PRIVACY_WARNING_COPY).toMatch(/name/i);
    expect(PRIVACY_WARNING_COPY).toMatch(/phone/i);
    expect(PRIVACY_WARNING_COPY).toMatch(/email/i);
    expect(PRIVACY_WARNING_COPY).toMatch(/account number/i);
    expect(PRIVACY_WARNING_COPY).toMatch(/address/i);
    expect(PRIVACY_WARNING_COPY).toMatch(/payment/i);
  });

  it("NOT_A_GRIEVANCE_CHANNEL_COPY never claims official status", () => {
    expect(NOT_A_GRIEVANCE_CHANNEL_COPY).toMatch(/independent research prototype/i);
    expect(NOT_A_GRIEVANCE_CHANNEL_COPY).toMatch(/not an official/i);
    expect(NOT_A_GRIEVANCE_CHANNEL_COPY).toMatch(/cannot resolve or forward/i);
    expect(NOT_A_GRIEVANCE_CHANNEL_COPY.toLowerCase()).not.toContain("verified");
    expect(NOT_A_GRIEVANCE_CHANNEL_COPY.toLowerCase()).not.toContain("official government of assam");
  });

  it("CONSENT_TO_PUBLISH_COPY explains review, possible redaction, and no guarantee", () => {
    expect(CONSENT_TO_PUBLISH_COPY).toMatch(/human moderator/i);
    expect(CONSENT_TO_PUBLISH_COPY).toMatch(/redact/i);
    expect(CONSENT_TO_PUBLISH_COPY).toMatch(/never guaranteed/i);
  });

  it("MODERATION_DISCLAIMER_COPY states moderated, not verified, and separate from audit findings", () => {
    expect(MODERATION_DISCLAIMER_COPY).toMatch(/shared with panchnama/i);
    expect(MODERATION_DISCLAIMER_COPY).toMatch(/moderated for relevance, privacy, and safety/i);
    expect(MODERATION_DISCLAIMER_COPY).toMatch(/not verified/i);
    expect(MODERATION_DISCLAIMER_COPY).toMatch(/not representative/i);
    expect(MODERATION_DISCLAIMER_COPY).toMatch(/never blended into panchnama's technical audit findings/i);
  });

  it("REMOVAL_CONTACT_COPY gives a placeholder contact and labels it as such", () => {
    expect(REMOVAL_CONTACT_COPY).toMatch(/privacy@panchnama\.example/);
    expect(REMOVAL_CONTACT_COPY).toMatch(/placeholder/i);
  });
});
