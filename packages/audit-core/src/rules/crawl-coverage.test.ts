import { describe, expect, it } from "vitest";
import { crawlCoverageSummaryRule } from "./crawl-coverage.js";
import { makeContext, makeInput, makePageObservation, makePortal } from "./test-fixtures.js";

describe("crawl_coverage.summary.v1", () => {
  const portal = makePortal();

  it("emits nothing when there is no data at all for the portal", () => {
    const result = crawlCoverageSummaryRule.evaluate(makeInput(portal), makeContext());
    expect(result).toEqual([]);
  });

  it("reports not_applicable when coverage is complete and nothing was skipped", () => {
    const obs = [makePageObservation(portal)];
    const result = crawlCoverageSummaryRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      makeContext({ crawlBoundaries: { maxPagesPerPortal: 40, maxDepth: 2 } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.checkStatus).toBe("not_applicable");
    expect(result[0]!.severity).toBe("advisory");
  });

  it("reports warning with a note when the page budget was reached", () => {
    const obs = Array.from({ length: 2 }, (_, i) =>
      makePageObservation(portal, { requestedUrl: `https://portal.assam.gov.in/p${i}` }),
    );
    const result = crawlCoverageSummaryRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      makeContext({ crawlBoundaries: { maxPagesPerPortal: 2, maxDepth: 2 } }),
    );
    expect(result[0]!.checkStatus).toBe("warning");
    expect(result[0]!.summary).toMatch(/budget/i);
  });

  it("notes robots-disallowed skips", () => {
    const result = crawlCoverageSummaryRule.evaluate(
      makeInput(portal, {
        skipLog: [
          { url: "https://portal.assam.gov.in/x", depth: 1, reason: "robots.txt disallowed" },
        ],
      }),
      makeContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.summary).toMatch(/robots/i);
  });
});
