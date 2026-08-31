import { describe, expect, it } from "vitest";
import { freshnessNoSignalRule } from "./freshness.js";
import { makeContext, makeInput, makePageObservation, makePortal } from "./test-fixtures.js";

describe("freshness.no-signal.v1", () => {
  const portal = makePortal();
  const ctx = makeContext();

  it("emits nothing when the entry page was never successfully observed", () => {
    const result = freshnessNoSignalRule.evaluate(
      makeInput(portal, { pageObservations: [] }),
      ctx,
      {},
    );
    expect(result).toEqual([]);
  });

  it("emits a pending-review, not-applicable, low-confidence finding for a successful entry page", () => {
    const obs = [makePageObservation(portal, { httpStatus: 200 })];
    const result = freshnessNoSignalRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.reviewStatus).toBe("pending_review");
    expect(result[0]!.checkStatus).toBe("not_applicable");
    expect(result[0]!.confidence).toBe("low");
    expect(result[0]!.summary).toMatch(/no recent update signal/i);
  });

  it("never claims definitive staleness", () => {
    const obs = [makePageObservation(portal, { httpStatus: 200 })];
    const result = freshnessNoSignalRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result[0]!.summary.toLowerCase()).not.toContain("stale");
  });
});
