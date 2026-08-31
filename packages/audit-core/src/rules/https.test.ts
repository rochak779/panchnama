import { describe, expect, it } from "vitest";
import { httpsCertificateFailureRule, httpsNoUpgradeRule } from "./https.js";
import { makeContext, makeInput, makePageObservation, makePortal } from "./test-fixtures.js";

describe("https.certificate-failure.v1", () => {
  const portal = makePortal();
  const ctx = makeContext();

  it("does not trigger when there is no certificate error", () => {
    const obs = [makePageObservation(portal, { httpStatus: 200 })];
    const result = httpsCertificateFailureRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toEqual([]);
  });

  it("triggers as significant/high on TLS_CERT_EXPIRED", () => {
    const obs = [
      makePageObservation(portal, { errorCode: "TLS_CERT_EXPIRED", httpStatus: undefined }),
    ];
    const result = httpsCertificateFailureRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("significant");
    expect(result[0]!.confidence).toBe("high");
  });

  it("triggers on TLS_HOST_MISMATCH", () => {
    const obs = [
      makePageObservation(portal, { errorCode: "TLS_HOST_MISMATCH", httpStatus: undefined }),
    ];
    const result = httpsCertificateFailureRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
  });
});

describe("https.no-tls-upgrade.v1", () => {
  const portal = makePortal();
  const ctx = makeContext();

  it("does not trigger when the final destination is https", () => {
    const obs = [makePageObservation(portal, { finalUrl: "https://portal.assam.gov.in/" })];
    const result = httpsNoUpgradeRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toEqual([]);
  });

  it("triggers when the final destination is http", () => {
    const obs = [
      makePageObservation(portal, {
        finalUrl: "http://portal.assam.gov.in/",
      }),
    ];
    const result = httpsNoUpgradeRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("advisory");
  });

  it("does not double up with a certificate-failure observation (errorCode set)", () => {
    const obs = [
      makePageObservation(portal, {
        errorCode: "TLS_CERT_EXPIRED",
        httpStatus: undefined,
      }),
    ];
    const result = httpsNoUpgradeRule.evaluate(
      makeInput(portal, { pageObservations: obs }),
      ctx,
      {},
    );
    expect(result).toEqual([]);
  });
});
