import { describe, expect, it } from "vitest";
import { brokenLinkRepeatedFailureRule } from "./broken-link.js";
import {
  makeContext,
  makeInput,
  makeInventorySource,
  makeLinkObservation,
  makePortal,
} from "./test-fixtures.js";

describe("broken_link.repeated-failure.v1", () => {
  it("emits nothing when all links pass", () => {
    const portal = makePortal();
    const links = [makeLinkObservation(portal, { status: "pass" })];
    const result = brokenLinkRepeatedFailureRule.evaluate(
      makeInput(portal, { linkObservations: links }),
      makeContext(),
    );
    expect(result).toEqual([]);
  });

  it("groups failures by normalized destination and reports distinct source pages", () => {
    const portal = makePortal();
    const links = [
      makeLinkObservation(portal, {
        sourcePageUrl: "https://portal.assam.gov.in/a",
        normalizedDestinationUrl: "https://dead.example.com/",
        status: "fail",
        errorCode: "HTTP_SERVER_ERROR",
      }),
      makeLinkObservation(portal, {
        sourcePageUrl: "https://portal.assam.gov.in/b",
        normalizedDestinationUrl: "https://dead.example.com/",
        status: "fail",
        errorCode: "HTTP_SERVER_ERROR",
      }),
    ];
    const result = brokenLinkRepeatedFailureRule.evaluate(
      makeInput(portal, { linkObservations: links }),
      makeContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.affectedUrls).toContain("https://portal.assam.gov.in/a");
    expect(result[0]!.affectedUrls).toContain("https://portal.assam.gov.in/b");
  });

  it("elevates severity to critical when the portal is officially sourced", () => {
    const source = makeInventorySource({ sourceType: "official_directory" });
    const portal = makePortal({ sourceRefs: [source.id] });
    const links = [makeLinkObservation(portal, { status: "fail", errorCode: "HTTP_SERVER_ERROR" })];
    const result = brokenLinkRepeatedFailureRule.evaluate(
      makeInput(portal, { linkObservations: links }),
      makeContext({ inventorySources: [source] }),
    );
    expect(result[0]!.severity).toBe("critical");
  });

  it("uses breadth (>=3 distinct source pages) to escalate severity when not officially sourced", () => {
    const portal = makePortal();
    const links = ["a", "b", "c"].map((p) =>
      makeLinkObservation(portal, {
        sourcePageUrl: `https://portal.assam.gov.in/${p}`,
        normalizedDestinationUrl: "https://dead.example.com/",
        status: "fail",
      }),
    );
    const result = brokenLinkRepeatedFailureRule.evaluate(
      makeInput(portal, { linkObservations: links }),
      makeContext(),
    );
    expect(result[0]!.severity).toBe("significant");
  });

  it("stays advisory for a single unofficial broken link from one source page", () => {
    const portal = makePortal();
    const links = [makeLinkObservation(portal, { status: "fail" })];
    const result = brokenLinkRepeatedFailureRule.evaluate(
      makeInput(portal, { linkObservations: links }),
      makeContext(),
    );
    expect(result[0]!.severity).toBe("advisory");
  });

  it("raises confidence to high when a link was retried before failing", () => {
    const portal = makePortal();
    const links = [makeLinkObservation(portal, { status: "fail", attempts: 2 })];
    const result = brokenLinkRepeatedFailureRule.evaluate(
      makeInput(portal, { linkObservations: links }),
      makeContext(),
    );
    expect(result[0]!.confidence).toBe("high");
  });
});
