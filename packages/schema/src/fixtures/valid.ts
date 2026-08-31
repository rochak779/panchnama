/**
 * Deterministic, mutually-consistent valid fixtures for every entity in
 * this package. These are plain TypeScript values (not JSON) so that
 * editing them is caught by the TypeScript compiler as well as by the
 * `.parse()` calls in the test suite — the two layers of drift protection
 * called for in the Session 1 task description.
 *
 * The fixtures tell one small, coherent story (one audit run, two related
 * portals, one finding on each path, one overlap comparison, one review
 * decision, one citizen experience) so that cross-referenced IDs
 * (`runId`, `portalId`, `overlapComparisonId`, `evidenceRefs`, ...) line up
 * the way they would in real generated data.
 */

import type { InventorySource } from "../inventory-source.js";
import type { Portal } from "../portal.js";
import type { AuditRun } from "../audit-run.js";
import type { PageObservation, LinkObservation } from "../observation.js";
import type { EvidenceArtifact } from "../evidence.js";
import type { Finding } from "../finding.js";
import type { PortalOverlapComparison } from "../overlap.js";
import type { PublishedPortalAssessment } from "../published-assessment.js";
import type { ReviewDecision } from "../review.js";
import type { ExperienceSubmission, PortalExperienceSummary } from "../experience.js";

export const validInventorySource: InventorySource = {
  id: "src-assam-directory-2026",
  schemaVersion: "1.0.0",
  name: "Assam State Portal Directory",
  authorityName: "Government of Assam, IT Department",
  url: "https://assam.gov.in/directory",
  sourceType: "official_directory",
  retrievedAt: "2026-08-01T06:00:00Z",
  evidencePath: "data/evidence/sources/src-assam-directory-2026.html",
  notes: "Primary seed directory for the pilot.",
};

export const validPortalA: Portal = {
  id: "portal-agri-assam",
  schemaVersion: "1.0.0",
  name: "Assam Agriculture Department Portal",
  canonicalUrl: "https://agriculture.assam.gov.in",
  alternateUrls: ["https://agri.assam.gov.in"],
  hostnames: ["agriculture.assam.gov.in", "agri.assam.gov.in"],
  description: "Departmental information and scheme portal.",
  department: "Department of Agriculture",
  geography: "assam",
  portalType: "information",
  officialStatus: "verified",
  sourceRefs: ["src-assam-directory-2026"],
  discovery: [
    {
      discoveredAt: "2026-08-01T06:05:00Z",
      discoveredFromUrl: "https://assam.gov.in/directory",
      discoveryMethod: "listed",
    },
  ],
  tags: ["agriculture", "department"],
  crawlProfile: "default",
};

export const validPortalB: Portal = {
  id: "portal-agri-farmers-welfare",
  schemaVersion: "1.0.0",
  name: "Assam Farmers Welfare Portal",
  canonicalUrl: "https://farmerswelfare.assam.gov.in",
  alternateUrls: [],
  hostnames: ["farmerswelfare.assam.gov.in"],
  description: "Farmer scheme enrollment portal.",
  department: "Department of Agriculture",
  geography: "assam",
  portalType: "transactional",
  officialStatus: "verified",
  sourceRefs: ["src-assam-directory-2026"],
  discovery: [
    {
      discoveredAt: "2026-08-01T06:06:00Z",
      discoveredFromUrl: "https://assam.gov.in/directory",
      discoveryMethod: "listed",
    },
  ],
  tags: ["agriculture", "welfare"],
};

export const validAuditRun: AuditRun = {
  id: "assam-2026-09-15-r1",
  geography: "assam",
  startedAt: "2026-09-15T02:00:00Z",
  completedAt: "2026-09-15T04:30:00Z",
  status: "partial",
  methodologyVersion: "1.0.0",
  schemaVersion: "1.0.0",
  codeRevision: "07d2c1e",
  nodeVersion: "22.11.0",
  packageVersionsDigest: "sha256:0f2a...digest",
  sourceRegistryDigest: "sha256:1a3b...digest",
  crawlPolicyDigest: "sha256:2c4d...digest",
  checkConfigDigest: "sha256:3e5f...digest",
  enabledChecks: ["availability.unavailable.v1", "redirect.cross-domain.v1"],
  portalCount: 2,
  portalsSucceeded: 1,
  portalsFailed: 0,
  portalsPartial: 1,
  limitations: ["Browser fallback disabled for this run."],
};

export const validPageObservation: PageObservation = {
  id: "obs-page-0001",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalId: "portal-agri-assam",
  requestedUrl: "https://agriculture.assam.gov.in",
  finalUrl: "https://agriculture.assam.gov.in/",
  discoveredFrom: "https://assam.gov.in/directory",
  checkedAt: "2026-09-15T02:05:00Z",
  attempt: 1,
  fetchMode: "http",
  httpStatus: 200,
  redirectChain: [{ url: "https://agriculture.assam.gov.in/", status: 200 }],
  contentType: "text/html; charset=utf-8",
  durationMs: 812,
  title: "Department of Agriculture, Assam",
  canonical: "https://agriculture.assam.gov.in/",
  language: "en",
  bodyDigest: "sha256:page-body-digest",
  robotsDecision: "allowed",
  artifactRefs: ["evidence-http-0001"],
};

export const validLinkObservation: LinkObservation = {
  id: "obs-link-0001",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalId: "portal-agri-assam",
  sourcePageUrl: "https://agriculture.assam.gov.in/",
  destinationUrl: "https://farmerswelfare.assam.gov.in/schemes",
  normalizedDestinationUrl: "https://farmerswelfare.assam.gov.in/schemes",
  anchorText: "Farmer Schemes",
  relationship: "external",
  context: "main navigation",
  checkedAt: "2026-09-15T02:06:00Z",
  status: "pass",
  httpStatus: 200,
  attempts: 1,
};

export const validEvidenceArtifactReviewed: EvidenceArtifact = {
  id: "evidence-http-0001",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalId: "portal-agri-assam",
  type: "http_response_snapshot",
  capturedAt: "2026-09-15T02:05:00Z",
  sourceUrl: "https://agriculture.assam.gov.in",
  relatedObservationId: "obs-page-0001",
  storagePath: "data/evidence/assam-2026-09-15-r1/evidence-http-0001.json",
  contentDigest: "sha256:evidence-digest-0001",
  mimeType: "application/json",
  description: "HTTP response snapshot of the portal homepage.",
  privacyReviewed: true,
  privacyReviewedAt: "2026-09-15T05:00:00Z",
  privacyReviewer: "editor-1",
};

export const validEvidenceArtifactForOverlap: EvidenceArtifact = {
  id: "evidence-note-0002",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalId: "portal-agri-farmers-welfare",
  type: "manual_note",
  capturedAt: "2026-09-15T05:10:00Z",
  storagePath: "data/evidence/assam-2026-09-15-r1/evidence-note-0002.json",
  contentDigest: "sha256:evidence-digest-0002",
  description: "Reviewer note comparing scope of both agriculture portals.",
  privacyReviewed: true,
  privacyReviewedAt: "2026-09-15T05:15:00Z",
  privacyReviewer: "editor-1",
};

export const validFindingAvailability: Finding = {
  id: "finding-availability-0001",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalId: "portal-agri-farmers-welfare",
  ruleId: "availability.unavailable.v1",
  category: "availability",
  title: "Portal entry point unavailable",
  summary: "Unavailable during three checks on 2026-09-14 and 2026-09-15.",
  severity: "significant",
  confidence: "high",
  checkStatus: "fail",
  reviewStatus: "reviewed",
  firstObservedAt: "2026-09-14T02:00:00Z",
  lastObservedAt: "2026-09-15T02:10:00Z",
  evidenceRefs: ["evidence-http-0001"],
  affectedUrls: ["https://farmerswelfare.assam.gov.in"],
  suggestionRuleId: "suggestion.repair.v1",
  suggestedAction: "repair",
  reviewerRationale: "Confirmed across three spaced attempts; not a bot block.",
  limitations: ["Single-region vantage point."],
};

export const validPortalOverlapComparison: PortalOverlapComparison = {
  id: "overlap-cmp-0001",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalIdA: "portal-agri-assam",
  portalIdB: "portal-agri-farmers-welfare",
  status: "completed",
  reviewedAt: "2026-09-15T06:00:00Z",
  reviewer: "editor-1",
  intendedUserA: "General public seeking department information",
  intendedUserB: "Registered farmers seeking scheme benefits",
  serviceOrTaskA: "Publish department news, schemes, and contacts",
  serviceOrTaskB: "Enroll in and track farmer welfare schemes",
  jurisdictionA: "Assam",
  jurisdictionB: "Assam",
  transactionStageA: "informational",
  transactionStageB: "transactional",
  responsibleAuthorityA: "Department of Agriculture",
  responsibleAuthorityB: "Department of Agriculture",
  linksOrRedirectsBetween: true,
  materialSimilarities: ["Same parent department", "Both reference the same scheme names"],
  materialDifferences: ["Portal A is informational only; Portal B accepts enrollments"],
  conclusion: "possible_overlap",
  uncertaintyNote: "Mandate boundary between the two portals is not clearly documented.",
  evidenceRefs: ["evidence-note-0002"],
};

export const validFindingOverlap: Finding = {
  id: "finding-overlap-0001",
  schemaVersion: "1.0.0",
  runId: "assam-2026-09-15-r1",
  portalId: "portal-agri-assam",
  ruleId: "overlap.manual-review.v1",
  category: "possible_overlap",
  title: "Possible functional overlap with Farmers Welfare Portal",
  summary: "Possible functional overlap; manual mandate and usage review required.",
  severity: "advisory",
  confidence: "medium",
  checkStatus: "warning",
  reviewStatus: "reviewed",
  firstObservedAt: "2026-09-15T06:00:00Z",
  lastObservedAt: "2026-09-15T06:00:00Z",
  evidenceRefs: ["evidence-note-0002"],
  affectedUrls: ["https://agriculture.assam.gov.in", "https://farmerswelfare.assam.gov.in"],
  suggestionRuleId: "suggestion.review-consolidation.v1",
  suggestedAction: "review_consolidation",
  overlapComparisonId: "overlap-cmp-0001",
  reviewerRationale: "See linked structured comparison.",
  limitations: [],
};

export const validReviewDecision: ReviewDecision = {
  schemaVersion: "1.0.0",
  findingId: "finding-availability-0001",
  decision: "publish",
  reviewedAt: "2026-09-15T06:30:00Z",
  reviewer: "editor-1",
  rationale: "Evidence is clear and repeated; publish as-is.",
};

export const validPublishedPortalAssessment: PublishedPortalAssessment = {
  schemaVersion: "1.0.0",
  portal: validPortalB,
  auditRunId: "assam-2026-09-15-r1",
  technicalHealth: "degraded",
  continuingRole: "possible_overlap",
  suggestedAction: "repair",
  criticalFindingCount: 0,
  significantFindingCount: 1,
  advisoryFindingCount: 0,
  crawlCoverage: {
    pagesAttempted: 5,
    pagesObserved: 3,
    linksChecked: 12,
    browserFallbackUsed: false,
    coverageNote: "Homepage and two linked pages observed before repeated failure.",
  },
  reviewedFindings: [validFindingAvailability],
  lastCheckedAt: "2026-09-15T02:10:00Z",
};

export const validExperienceSubmission: ExperienceSubmission = {
  id: "experience-0001",
  schemaVersion: "1.0.0",
  portalId: "portal-agri-farmers-welfare",
  createdAt: "2026-09-10T10:00:00Z",
  occurredOn: "2026-09",
  taskType: "scheme_enrollment",
  taskDescription: "Tried to enroll for a fertilizer subsidy scheme.",
  outcome: "not_completed",
  themes: ["availability", "form_or_validation"],
  deviceType: "mobile",
  experienceRating: 2,
  freeText: "The enrollment page kept timing out on my phone.",
  consentToPublish: true,
  status: "approved",
  moderatedAt: "2026-09-11T09:00:00Z",
  moderationReasonCode: "approved_relevant",
  publicText: "The enrollment page kept timing out on a mobile device.",
  source: "public_form",
  privacyFlags: [],
};

export const validPortalExperienceSummary: PortalExperienceSummary = {
  schemaVersion: "1.0.0",
  portalId: "portal-agri-farmers-welfare",
  approvedExperienceCount: 1,
  outcomeCounts: {
    completed: 0,
    partially_completed: 0,
    not_completed: 1,
    information_only: 0,
  },
  themeCounts: {
    availability: 1,
    form_or_validation: 1,
  },
  ratingCount: 1,
  averageRating: 2,
  earliestExperienceDate: "2026-09",
  latestExperienceDate: "2026-09",
  minimumDisplayThresholdApplied: true,
  generatedAt: "2026-09-15T07:00:00Z",
};
