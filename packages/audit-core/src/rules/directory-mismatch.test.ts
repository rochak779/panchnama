import { describe, expect, it } from "vitest";
import {
  directoryMismatchListedVsObservedRule,
  directoryMismatchOfficialNotListedRule,
  directoryMismatchUnavailableDestinationRule,
} from "./directory-mismatch.js";
import {
  makeContext,
  makeInput,
  makeInventorySource,
  makePageObservation,
  makePortal,
} from "./test-fixtures.js";
import type { FindingDraft } from "./types.js";

describe("directory_mismatch.unavailable-destination.v1", () => {
  it("does not trigger without a critical availability finding", () => {
    const source = makeInventorySource({ sourceType: "official_directory" });
    const portal = makePortal({ sourceRefs: [source.id] });
    const result = directoryMismatchUnavailableDestinationRule.evaluate(
      makeInput(portal, { priorFindings: [] }),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toEqual([]);
  });

  it("triggers when a prior critical availability finding exists and the portal is directory-sourced", () => {
    const source = makeInventorySource({ sourceType: "official_directory" });
    const portal = makePortal({ sourceRefs: [source.id] });
    const priorFindings: FindingDraft[] = [
      {
        portalId: portal.id,
        ruleId: "availability.unavailable.v1",
        category: "availability",
        title: "x",
        summary: "x",
        severity: "critical",
        confidence: "high",
        checkStatus: "fail",
        reviewStatus: "pending_review",
        firstObservedAt: "2026-08-01T00:00:00.000Z",
        lastObservedAt: "2026-08-01T00:00:00.000Z",
        affectedUrls: [],
        suggestionRuleId: "x",
        suggestedAction: "repair",
        limitations: [],
        evidence: [{ type: "text_excerpt", description: "x", content: "x" }],
      },
    ];
    const result = directoryMismatchUnavailableDestinationRule.evaluate(
      makeInput(portal, { priorFindings }),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("advisory");
  });
});

describe("directory_mismatch.listed-vs-observed.v1", () => {
  it("does not trigger when name and host both agree", () => {
    const source = makeInventorySource({
      sourceType: "official_directory",
      name: "Test Portal",
      url: "https://portal.assam.gov.in/directory",
    });
    const portal = makePortal({ sourceRefs: [source.id], name: "Test Portal" });
    const obs = [makePageObservation(portal, { finalUrl: portal.canonicalUrl })];
    const result = directoryMismatchListedVsObservedRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toEqual([]);
  });

  it("triggers on name disagreement", () => {
    const source = makeInventorySource({
      sourceType: "official_directory",
      name: "Completely Unrelated Service",
      url: "https://portal.assam.gov.in/directory",
    });
    const portal = makePortal({ sourceRefs: [source.id], name: "Test Portal" });
    const result = directoryMismatchListedVsObservedRule.evaluate(
      makeInput(portal, {}),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toHaveLength(1);
  });

  it("triggers on host disagreement", () => {
    const source = makeInventorySource({
      sourceType: "official_directory",
      name: "Test Portal",
      url: "https://different-host.example.com/",
    });
    const portal = makePortal({ sourceRefs: [source.id], name: "Test Portal" });
    const result = directoryMismatchListedVsObservedRule.evaluate(
      makeInput(portal, {}),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toHaveLength(1);
  });
});

describe("directory_mismatch.official-portal-not-listed.v1", () => {
  it("does not trigger for an unverified portal", () => {
    const source = makeInventorySource({ sourceType: "manual_verified" });
    const portal = makePortal({ officialStatus: "unverified", sourceRefs: [source.id] });
    const result = directoryMismatchOfficialNotListedRule.evaluate(
      makeInput(portal, {}),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toEqual([]);
  });

  it("triggers for a verified portal with no official_directory source", () => {
    const source = makeInventorySource({ sourceType: "manual_verified" });
    const portal = makePortal({ officialStatus: "verified", sourceRefs: [source.id] });
    const result = directoryMismatchOfficialNotListedRule.evaluate(
      makeInput(portal, {}),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toHaveLength(1);
  });

  it("does not trigger for a verified portal that IS backed by an official_directory source", () => {
    const source = makeInventorySource({ sourceType: "official_directory" });
    const portal = makePortal({ officialStatus: "verified", sourceRefs: [source.id] });
    const result = directoryMismatchOfficialNotListedRule.evaluate(
      makeInput(portal, {}),
      makeContext({ inventorySources: [source] }),
    );
    expect(result).toEqual([]);
  });
});
