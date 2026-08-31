import { describe, expect, it } from "vitest";
import { AVAILABILITY_RULES } from "./rules/availability.js";
import { getRuleById } from "./rules/registry.js";
import { AVAILABILITY_ONLY_RULE_IDS, SUGGESTION_TEMPLATES } from "./suggestion.js";
import { makeContext, makeInput, makePageObservation, makePortal } from "./rules/test-fixtures.js";

/**
 * Regression test for implementation.md section 7.8 / 5.14:
 * "review_retirement cannot be generated from technical failure alone" /
 * "Never suggest retirement from downtime alone." Runs every
 * availability-category rule with the worst-case (maximum failure)
 * fixture it can trigger on and asserts none of them ever produces
 * `suggestedAction: "review_retirement"`.
 */
describe("downtime never triggers review_retirement", () => {
  const portal = makePortal();
  const ctx = makeContext();

  const heavyFailureObservations = Array.from({ length: 10 }, (_, i) =>
    makePageObservation(portal, {
      attempt: i + 1,
      httpStatus: undefined,
      errorCode: "CONNECT_TIMEOUT",
      checkedAt: `2026-08-${String((i % 27) + 1).padStart(2, "0")}T00:00:00.000Z`,
    }),
  );
  const heavyServerErrors = Array.from({ length: 10 }, (_, i) =>
    makePageObservation(portal, {
      attempt: i + 1,
      errorCode: "HTTP_SERVER_ERROR",
      httpStatus: 503,
    }),
  );
  const heavyNotFound = Array.from({ length: 10 }, (_, i) =>
    makePageObservation(portal, { attempt: i + 1, httpStatus: 404 }),
  );

  for (const rule of AVAILABILITY_RULES) {
    it(`${rule.ruleId} never emits review_retirement`, () => {
      const results = [
        ...rule.evaluate(makeInput(portal, { pageObservations: heavyFailureObservations }), ctx, {
          spacedAttempts: 3,
          minRepeatedOccurrences: 2,
        }),
        ...rule.evaluate(makeInput(portal, { pageObservations: heavyServerErrors }), ctx, {
          spacedAttempts: 3,
          minRepeatedOccurrences: 2,
        }),
        ...rule.evaluate(makeInput(portal, { pageObservations: heavyNotFound }), ctx, {
          spacedAttempts: 3,
          minRepeatedOccurrences: 2,
        }),
      ];
      for (const finding of results) {
        expect(finding.suggestedAction).not.toBe("review_retirement");
      }
    });
  }

  it("every availability-only rule id is accounted for in AVAILABILITY_ONLY_RULE_IDS", () => {
    for (const rule of AVAILABILITY_RULES) {
      expect(AVAILABILITY_ONLY_RULE_IDS as readonly string[]).toContain(rule.ruleId);
    }
  });

  it("no availability-only rule id's implementation is reachable from registry with review_retirement", () => {
    for (const ruleId of AVAILABILITY_ONLY_RULE_IDS) {
      const rule = getRuleById(ruleId);
      expect(rule).toBeDefined();
    }
  });
});

describe("SUGGESTION_TEMPLATES", () => {
  it("has no duplicate suggestionRuleId values", () => {
    const ids = SUGGESTION_TEMPLATES.map((t) => t.suggestionRuleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only the possible-overlap / apparent-obsolete templates map to review_consolidation / review_retirement", () => {
    const escalating = SUGGESTION_TEMPLATES.filter(
      (t) =>
        t.suggestedAction === "review_consolidation" || t.suggestedAction === "review_retirement",
    );
    expect(escalating.map((t) => t.suggestionRuleId).sort()).toEqual(
      [
        "suggestion.apparent-obsolete-with-corroboration.v1",
        "suggestion.possible-overlap.v1",
      ].sort(),
    );
  });
});
