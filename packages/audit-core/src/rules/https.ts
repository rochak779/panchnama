/**
 * HTTPS / certificate rule — implementation.md section 7.3.
 *
 * Thin classifier over signals ordinary page access already produced by
 * the crawler (Session 4's TLS error classification in
 * `crawl-errors.ts`, and the redirect chain recorded on `PageObservation`)
 * — this does NOT scan ciphers, ports, vulnerabilities, or server
 * configuration, per section 7.3's explicit "not a security audit" scope
 * limit.
 */

import type { PageObservation } from "@panchnama/schema";
import type { Rule } from "./types.js";

function entryObservations(
  portal: { canonicalUrl: string },
  obs: PageObservation[],
): PageObservation[] {
  return obs.filter((o) => o.requestedUrl === portal.canonicalUrl);
}

export const httpsCertificateFailureRule: Rule = {
  ruleId: "https.certificate-failure.v1",
  version: 1,
  category: "https",
  description: "Certificate expiry or hostname mismatch observed while accessing the entry page.",
  evaluate: ({ portal, pageObservations }) => {
    const entries = entryObservations(portal, pageObservations);
    const failures = entries.filter(
      (o) => o.errorCode === "TLS_CERT_EXPIRED" || o.errorCode === "TLS_HOST_MISMATCH",
    );
    if (failures.length === 0) return [];
    const o = failures[0]!;
    return [
      {
        portalId: portal.id,
        ruleId: "https.certificate-failure.v1",
        category: "https" as const,
        title:
          o.errorCode === "TLS_CERT_EXPIRED"
            ? "Certificate expired"
            : "Certificate hostname mismatch",
        summary: `Accessing ${o.requestedUrl} produced a certificate error (${o.errorCode}) as observed by the client.`,
        severity: "significant" as const,
        confidence: "high" as const,
        checkStatus: "fail" as const,
        reviewStatus: "pending_review" as const,
        firstObservedAt: failures[0]!.checkedAt,
        lastObservedAt: failures[failures.length - 1]!.checkedAt,
        affectedUrls: [o.requestedUrl],
        suggestionRuleId: "suggestion.certificate-failure.v1",
        suggestedAction: "repair" as const,
        limitations: [
          "This reflects only what ordinary page access revealed via the client's TLS handshake, not a full certificate/vulnerability scan.",
        ],
        evidence: [
          {
            type: "certificate_detail" as const,
            description: `${o.requestedUrl} produced a certificate error observed by the client: ${o.errorCode}${o.errorMessage ? ` (${o.errorMessage})` : ""}.`,
            sourceUrl: o.requestedUrl,
            relatedObservationId: o.id,
            content: JSON.stringify(failures),
          },
        ],
      },
    ];
  },
};

export const httpsNoUpgradeRule: Rule = {
  ruleId: "https.no-tls-upgrade.v1",
  version: 1,
  category: "https",
  description: "Final destination for the entry URL does not use HTTPS.",
  evaluate: ({ portal, pageObservations }) => {
    const entries = entryObservations(portal, pageObservations);
    const drafts = [];
    for (const o of entries) {
      if (o.errorCode !== undefined) continue; // covered by other rules
      const finalUrl = o.finalUrl ?? o.requestedUrl;
      let scheme: string;
      try {
        scheme = new URL(finalUrl).protocol;
      } catch {
        continue;
      }
      if (scheme === "https:") continue;
      drafts.push({
        portalId: portal.id,
        ruleId: "https.no-tls-upgrade.v1",
        category: "https" as const,
        title: "Entry page is not served over HTTPS",
        summary: `The final destination for ${o.requestedUrl} (${finalUrl}) does not use HTTPS.`,
        severity: "advisory" as const,
        confidence: "medium" as const,
        checkStatus: "warning" as const,
        reviewStatus: "pending_review" as const,
        firstObservedAt: o.checkedAt,
        lastObservedAt: o.checkedAt,
        affectedUrls: [finalUrl],
        suggestionRuleId: "suggestion.certificate-failure.v1",
        suggestedAction: "manual_assessment" as const,
        limitations: [
          "This checks only the scheme of the final observed destination, not whether an HTTPS variant exists or is reachable.",
        ],
        evidence: [
          {
            type: "http_response_snapshot" as const,
            description: `${o.requestedUrl} was ultimately served at ${finalUrl}, which does not use HTTPS.`,
            sourceUrl: o.requestedUrl,
            relatedObservationId: o.id,
            content: JSON.stringify(o),
          },
        ],
      });
    }
    return drafts;
  },
};

export const HTTPS_RULES: Rule[] = [httpsCertificateFailureRule, httpsNoUpgradeRule];
