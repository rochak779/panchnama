import { describe, expect, it } from "vitest";
import {
  availabilityAccessRestrictedRule,
  availabilityAutomationBlockedRule,
  availabilityNotFoundRule,
  availabilityServerErrorRule,
  availabilityUnavailableRule,
  redirectCrossDomainRule,
} from "./availability.js";
import { makeContext, makeInput, makePageObservation, makePortal } from "./test-fixtures.js";

describe("availability.unavailable.v1", () => {
  const portal = makePortal({ canonicalUrl: "https://portal.assam.gov.in/" });
  const ctx = makeContext();

  function failures(n: number) {
    return Array.from({ length: n }, (_, i) =>
      makePageObservation(portal, {
        attempt: i + 1,
        httpStatus: undefined,
        errorCode: "CONNECT_TIMEOUT",
        errorMessage: "connection timed out",
        checkedAt: `2026-08-0${i + 1}T00:00:00.000Z`,
      }),
    );
  }

  it("does not trigger one below the threshold (2 of 3)", () => {
    const result = availabilityUnavailableRule.evaluate(
      makeInput(portal, { pageObservations: failures(2) }),
      ctx,
      { spacedAttempts: 3 },
    );
    expect(result).toEqual([]);
  });

  it("triggers exactly at the threshold (3 of 3)", () => {
    const result = availabilityUnavailableRule.evaluate(
      makeInput(portal, { pageObservations: failures(3) }),
      ctx,
      { spacedAttempts: 3 },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("critical");
    expect(result[0]!.confidence).toBe("high");
    expect(result[0]!.suggestedAction).toBe("repair");
  });

  it("triggers above the threshold (4 of 3)", () => {
    const result = availabilityUnavailableRule.evaluate(
      makeInput(portal, { pageObservations: failures(4) }),
      ctx,
      { spacedAttempts: 3 },
    );
    expect(result).toHaveLength(1);
  });

  it("does not count successful browser-mode fallback observations as failures", () => {
    const obs = [
      ...failures(2),
      makePageObservation(portal, {
        attempt: 3,
        fetchMode: "browser",
        errorCode: undefined,
        httpStatus: 200,
      }),
    ];
    const result = availabilityUnavailableRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {
        spacedAttempts: 3,
      },
    );
    expect(result).toEqual([]);
  });

  it("triggers from a SINGLE real-world observation whose own attempt field already encodes 3 retries", () => {
    // Mirrors real crawl output: the frontier fetches a URL once per run,
    // and http-fetcher.ts's own retry loop already folds retries into one
    // final PageObservation with `attempt` set to the retry count.
    const obs = [
      makePageObservation(portal, {
        attempt: 3,
        errorCode: "CONNECT_TIMEOUT",
        httpStatus: undefined,
      }),
    ];
    const result = availabilityUnavailableRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {
        spacedAttempts: 3,
      },
    );
    expect(result).toHaveLength(1);
  });

  it("does not trigger from a single observation one attempt below threshold", () => {
    const obs = [
      makePageObservation(portal, {
        attempt: 2,
        errorCode: "CONNECT_TIMEOUT",
        httpStatus: undefined,
      }),
    ];
    const result = availabilityUnavailableRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {
        spacedAttempts: 3,
      },
    );
    expect(result).toEqual([]);
  });

  it("does not count a 401/403 as a total-connection failure", () => {
    const obs = [
      ...failures(2),
      makePageObservation(portal, { attempt: 3, errorCode: "AUTH_REQUIRED", httpStatus: 401 }),
    ];
    const result = availabilityUnavailableRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {
        spacedAttempts: 3,
      },
    );
    expect(result).toEqual([]);
  });
});

describe("availability.server-error.v1", () => {
  const portal = makePortal();
  const ctx = makeContext();
  function serverErrors(n: number) {
    return Array.from({ length: n }, (_, i) =>
      makePageObservation(portal, {
        attempt: i + 1,
        errorCode: "HTTP_SERVER_ERROR",
        httpStatus: 503,
      }),
    );
  }

  it("does not trigger one below threshold (1 of 2)", () => {
    const result = availabilityServerErrorRule.evaluate(
      makeInput(portal, { pageObservations: serverErrors(1) }),
      ctx,
      { minRepeatedOccurrences: 2 },
    );
    expect(result).toEqual([]);
  });

  it("triggers at threshold (2 of 2) as significant", () => {
    const result = availabilityServerErrorRule.evaluate(
      makeInput(portal, { pageObservations: serverErrors(2) }),
      ctx,
      { minRepeatedOccurrences: 2 },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("significant");
  });

  it("escalates to critical beyond threshold (3 of 2)", () => {
    const result = availabilityServerErrorRule.evaluate(
      makeInput(portal, { pageObservations: serverErrors(3) }),
      ctx,
      { minRepeatedOccurrences: 2 },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("critical");
  });
});

describe("availability.not-found.v1", () => {
  const portal = makePortal();
  const ctx = makeContext();
  function notFounds(n: number) {
    return Array.from({ length: n }, (_, i) =>
      makePageObservation(portal, { attempt: i + 1, httpStatus: 404 }),
    );
  }

  it("does not trigger below threshold", () => {
    const result = availabilityNotFoundRule.evaluate(
      makeInput(portal, { pageObservations: notFounds(1) }),
      ctx,
      { minRepeatedOccurrences: 2 },
    );
    expect(result).toEqual([]);
  });

  it("triggers at threshold as critical", () => {
    const result = availabilityNotFoundRule.evaluate(
      makeInput(portal, { pageObservations: notFounds(2) }),
      ctx,
      { minRepeatedOccurrences: 2 },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("critical");
    expect(result[0]!.confidence).toBe("high");
  });

  it("also triggers on 410 Gone", () => {
    const obs = [
      makePageObservation(portal, { attempt: 1, httpStatus: 410 }),
      makePageObservation(portal, { attempt: 2, httpStatus: 410 }),
    ];
    const result = availabilityNotFoundRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {
        minRepeatedOccurrences: 2,
      },
    );
    expect(result).toHaveLength(1);
  });
});

describe("redirect.cross-domain.v1", () => {
  const portal = makePortal({ hostnames: ["portal.assam.gov.in"] });
  const ctx = makeContext();

  it("does not trigger when the final host is registered", () => {
    const obs = [makePageObservation(portal, { finalUrl: "https://portal.assam.gov.in/home" })];
    const result = redirectCrossDomainRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toEqual([]);
  });

  it("triggers when the final host is unregistered", () => {
    const obs = [makePageObservation(portal, { finalUrl: "https://otherdomain.example.com/" })];
    const result = redirectCrossDomainRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("advisory");
    expect(result[0]!.reviewStatus).toBe("pending_review");
  });
});

describe("availability.automation-blocked.v1", () => {
  const portal = makePortal();
  const ctx = makeContext();

  it("emits not_assessable, not a critical failure", () => {
    const obs = [
      makePageObservation(portal, { errorCode: "AUTOMATION_BLOCKED", httpStatus: undefined }),
    ];
    const result = availabilityAutomationBlockedRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.checkStatus).toBe("not_assessable");
    expect(result[0]!.severity).not.toBe("critical");
    expect(result[0]!.suggestedAction).toBe("manual_assessment");
  });
});

describe("availability.access-restricted.v1 (401/403 carve-out)", () => {
  const portal = makePortal();
  const ctx = makeContext();

  it("surfaces a 401 as low-confidence, not-assessable, never critical", () => {
    const obs = [makePageObservation(portal, { errorCode: "AUTH_REQUIRED", httpStatus: 401 })];
    const result = availabilityAccessRestrictedRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).not.toBe("critical");
    expect(result[0]!.confidence).toBe("low");
    expect(result[0]!.checkStatus).toBe("not_assessable");
  });

  it("surfaces a 403 the same way", () => {
    const obs = [makePageObservation(portal, { errorCode: "HTTP_CLIENT_ERROR", httpStatus: 403 })];
    const result = availabilityAccessRestrictedRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).not.toBe("critical");
  });

  it("does not trigger on a generic 4xx client error that is not 401/403", () => {
    const obs = [makePageObservation(portal, { errorCode: "HTTP_CLIENT_ERROR", httpStatus: 400 })];
    const result = availabilityAccessRestrictedRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toEqual([]);
  });
});
