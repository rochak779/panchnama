import { describe, expect, it } from "vitest";
import {
  UnknownPortalIdError,
  SubmissionNotFoundError,
  InvalidModerationDecisionError,
} from "../errors.js";
import { truncateForModerationPreview } from "./moderation.js";

/**
 * Section 9.8: "Do not log request bodies" / "Scrub framework error
 * reporting so free text cannot reach telemetry." This package's error
 * types never accept or interpolate free text into their `.message` (only
 * ids and fixed strings) — asserted here directly rather than by spying on
 * console output, since the errors are the one place this package
 * constructs strings that could accidentally embed caller-provided text.
 * The rest of the "never log free text" property is enforced by code
 * review: `src/repository/*.ts` and `src/scripts/*.ts` never pass a
 * `freeText`/`publicText` value to `console.*` — see docs/session-log.md.
 */
describe("error messages never embed free text", () => {
  it("UnknownPortalIdError only interpolates the portalId", () => {
    const err = new UnknownPortalIdError("portal-x");
    expect(err.message).toBe('portalId "portal-x" is not a known published portal id.');
  });

  it("SubmissionNotFoundError only interpolates the submissionId", () => {
    const err = new SubmissionNotFoundError("abc-123");
    expect(err.message).toBe('No submission found with id "abc-123".');
  });

  it("InvalidModerationDecisionError message is a fixed string", () => {
    const err = new InvalidModerationDecisionError("fixed message");
    expect(err.message).toBe("fixed message");
  });
});

describe("truncateForModerationPreview", () => {
  it("passes short text through unchanged", () => {
    expect(truncateForModerationPreview("short")).toBe("short");
  });

  it("caps long text with an ellipsis rather than dumping it unbounded", () => {
    const long = "a".repeat(500);
    const preview = truncateForModerationPreview(long);
    expect(preview?.length).toBeLessThan(200);
    expect(preview?.endsWith("…")).toBe(true);
  });

  it("returns null for null input", () => {
    expect(truncateForModerationPreview(null)).toBeNull();
  });
});
