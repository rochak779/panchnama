import type { InventorySource, LinkObservation, PageObservation, Portal } from "@panchnama/schema";
import type { AnalysisContext, PortalRuleInput } from "./types.js";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function makePortal(overrides: Partial<Portal> = {}): Portal {
  return {
    id: overrides.id ?? nextId("portal"),
    schemaVersion: "1.0.0",
    name: "Test Portal",
    canonicalUrl: "https://portal.assam.gov.in/",
    alternateUrls: [],
    hostnames: ["portal.assam.gov.in"],
    geography: "assam",
    portalType: "information",
    officialStatus: "unverified",
    sourceRefs: [],
    discovery: [],
    tags: [],
    ...overrides,
  };
}

export function makePageObservation(
  portal: Portal,
  overrides: Partial<PageObservation> = {},
): PageObservation {
  return {
    id: overrides.id ?? nextId("page-obs"),
    schemaVersion: "1.0.0",
    runId: "test-run",
    portalId: portal.id,
    requestedUrl: portal.canonicalUrl,
    checkedAt: "2026-08-01T00:00:00.000Z",
    attempt: 1,
    fetchMode: "http",
    httpStatus: 200,
    redirectChain: [],
    robotsDecision: "allowed",
    artifactRefs: [],
    ...overrides,
  };
}

export function makeLinkObservation(
  portal: Portal,
  overrides: Partial<LinkObservation> = {},
): LinkObservation {
  return {
    id: overrides.id ?? nextId("link-obs"),
    schemaVersion: "1.0.0",
    runId: "test-run",
    portalId: portal.id,
    sourcePageUrl: portal.canonicalUrl,
    destinationUrl: "https://example.com/service",
    normalizedDestinationUrl: "https://example.com/service",
    relationship: "external",
    checkedAt: "2026-08-01T00:00:00.000Z",
    status: "pass",
    attempts: 1,
    ...overrides,
  };
}

export function makeInventorySource(overrides: Partial<InventorySource> = {}): InventorySource {
  return {
    id: overrides.id ?? nextId("source"),
    schemaVersion: "1.0.0",
    name: "Assam Official Directory",
    authorityName: "Government of Assam",
    url: "https://assam.gov.in/directory",
    sourceType: "official_directory",
    retrievedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeContext(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    runId: "test-run",
    analyzedAt: "2026-08-01T00:00:00.000Z",
    allPortals: [],
    inventorySources: [],
    crawlBoundaries: { maxPagesPerPortal: 40, maxDepth: 2 },
    ...overrides,
  };
}

export function makeInput(
  portal: Portal,
  overrides: Partial<Omit<PortalRuleInput, "portal">> = {},
): PortalRuleInput {
  return {
    portal,
    pageObservations: [],
    linkObservations: [],
    skipLog: [],
    priorFindings: [],
    ...overrides,
  };
}
