import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_VERSIONS, type EvidenceArtifact, type Finding } from "@panchnama/schema";
import type { EvidenceDraft, FindingDraft } from "@panchnama/audit-core";

/**
 * Turns each rule's `FindingDraft` (from `@panchnama/audit-core`) into a
 * real, stored `Finding` plus one real `EvidenceArtifact` per
 * `EvidenceDraft` it carried — implementation.md section 14 Session 7:
 * "Materialize typed EvidenceArtifact records for generated finding
 * evidence and ensure every generated evidenceRefs value resolves to one
 * of them."
 *
 * Evidence storage convention (mirrors Session 6's screenshot convention
 * in `crawl/evidence.ts`): each evidence draft's serialized `content` is
 * written to a small JSON file under
 *
 *   data/evidence/<runId>/analysis/<evidenceArtifactId>.json
 *
 * `EvidenceArtifact.storagePath` records the path RELATIVE to
 * `data/evidence/`, matching §5.8's "path under data/evidence/" and
 * Session 6's precedent. `privacyReviewed` is always `false` — no human
 * has reviewed auto-generated evidence yet; Session 8's publication gate
 * is what enforces `privacyReviewed: true` before any Finding may cite it
 * (§5.8's own note, §8.3 item 3).
 */
export interface MaterializeParams {
  runId: string;
  evidenceOutDir: string;
  now: () => string;
}

let sequence = 0;
function nextSequence(): number {
  sequence += 1;
  return sequence;
}

/** Reset the module-local sequence counter — test-only, so repeated test
 * runs in the same process get deterministic ids. */
export function resetMaterializeSequenceForTests(): void {
  sequence = 0;
}

function sanitizeForId(value: string): string {
  return value.replace(/[^A-Za-z0-9._~-]/g, "_");
}

export function materializeFindingDraft(
  draft: FindingDraft,
  params: MaterializeParams,
): { finding: Finding; evidence: EvidenceArtifact[] } {
  const findingId = `finding-${sanitizeForId(params.runId)}-${sanitizeForId(draft.portalId)}-${sanitizeForId(draft.ruleId)}-${nextSequence()}`;
  const capturedAt = params.now();

  const evidenceArtifacts = draft.evidence.map((ev) =>
    materializeEvidenceDraft(ev, findingId, draft.portalId, { ...params, capturedAt }),
  );

  const finding: Finding = {
    id: findingId,
    schemaVersion: SCHEMA_VERSIONS.finding,
    runId: params.runId,
    portalId: draft.portalId,
    ruleId: draft.ruleId,
    category: draft.category,
    title: draft.title,
    summary: draft.summary,
    severity: draft.severity,
    confidence: draft.confidence,
    checkStatus: draft.checkStatus,
    reviewStatus: draft.reviewStatus,
    firstObservedAt: draft.firstObservedAt,
    lastObservedAt: draft.lastObservedAt,
    evidenceRefs: evidenceArtifacts.map((e) => e.id),
    affectedUrls: draft.affectedUrls,
    suggestionRuleId: draft.suggestionRuleId,
    suggestedAction: draft.suggestedAction,
    limitations: draft.limitations,
    ...(draft.reviewerRationale !== undefined
      ? { reviewerRationale: draft.reviewerRationale }
      : {}),
  };

  return { finding, evidence: evidenceArtifacts };
}

function materializeEvidenceDraft(
  draft: EvidenceDraft,
  findingId: string,
  portalId: string,
  params: MaterializeParams & { capturedAt: string },
): EvidenceArtifact {
  const evidenceId = `evidence-${findingId}-${nextSequence()}`;
  const relativeDir = join(params.runId, "analysis");
  const relativePath = join(relativeDir, `${evidenceId}.json`);
  const absoluteDir = join(params.evidenceOutDir, relativeDir);
  mkdirSync(absoluteDir, { recursive: true });
  const absolutePath = join(params.evidenceOutDir, relativePath);
  writeFileSync(absolutePath, draft.content, "utf8");

  const contentDigest = createHash("sha256").update(draft.content).digest("hex");

  const artifact: EvidenceArtifact = {
    id: evidenceId,
    schemaVersion: SCHEMA_VERSIONS.evidenceArtifact,
    runId: params.runId,
    portalId,
    type: draft.type,
    capturedAt: params.capturedAt,
    storagePath: relativePath,
    contentDigest,
    mimeType: "application/json",
    description: draft.description,
    privacyReviewed: false,
    ...(draft.sourceUrl !== undefined ? { sourceUrl: draft.sourceUrl } : {}),
    ...(draft.relatedObservationId !== undefined
      ? { relatedObservationId: draft.relatedObservationId }
      : {}),
  };
  return artifact;
}
