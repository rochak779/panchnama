import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_VERSIONS, type EvidenceArtifact } from "@panchnama/schema";

/**
 * Evidence-artifact capture for browser-mode fallback — implementation.md
 * section 5.8 (`EvidenceArtifact`) and section 14 Session 6 ("Artifact
 * capture for selected evidence only").
 *
 * Storage convention (new this session — Sessions 4/5 produced no
 * `EvidenceArtifact` records, since they had nothing to capture):
 * mirroring `data/raw/crawl/<runId>/` (section 4.3's `data/raw/`) and
 * section 4.3's own `data/evidence/` bucket, screenshots are written to
 *
 *   data/evidence/<runId>/<portalId>/<pageObservationId>.png
 *
 * `EvidenceArtifact.storagePath` records the path RELATIVE to
 * `data/evidence/` (i.e. `<runId>/<portalId>/<pageObservationId>.png`),
 * matching the schema doc's "path under data/evidence/". The crawl run's
 * own output directory additionally gets an `evidence-artifacts.jsonl`
 * (same one-record-per-line convention as `page-observations.jsonl` /
 * `link-observations.jsonl`) so a run's evidence is discoverable from its
 * own output folder without a separate index.
 *
 * `privacyReviewed` is always `false` here — no human has reviewed a
 * freshly captured screenshot yet; the publication gate that requires
 * `privacyReviewed: true` before any `Finding` may cite it is Session 8's
 * job (implementation.md section 5.8's own note, and section 8.3 item 3).
 *
 * "Selected evidence only" trigger condition (documented per the task
 * brief's requirement to pick and justify one): a screenshot is captured
 * and turned into an `EvidenceArtifact` ONLY when browser fallback was the
 * deciding factor in a meaningful outcome for that page, specifically:
 *   (a) the shell-detection heuristic fired on the HTTP attempt AND the
 *       browser-mode fetch succeeded (`ok: true`) — i.e. browser mode
 *       actually recovered real content the HTTP fetch could not see, the
 *       single strongest case for wanting visual evidence of what browser
 *       mode rendered; or
 *   (b) the browser-mode fetch was blocked (`errorCode` is
 *       `AUTOMATION_BLOCKED` or `AUTH_REQUIRED`) — a screenshot is the
 *       clearest possible evidence of *why* the page was classified this
 *       way, for a human reviewer to confirm without re-running the crawl.
 * An ordinary successful browser fetch that was NOT triggered by a
 * detected shell (e.g. a defensive/precautionary browser fetch a future
 * session might add) does not get a screenshot — this keeps evidence
 * capture bounded to pages where it actually explains an outcome, per
 * section 5.8's evidence-is-curated intent, not a blanket "screenshot
 * every browser page."
 */
/**
 * Pure decision function implementing the "selected evidence only" trigger
 * condition documented above — extracted so it is directly unit-testable
 * without needing to drive a full browser fetch. `frontier.ts` calls this
 * (implicitly, via the same two conditions) before spending the cost of
 * writing a screenshot to disk.
 */
export function shouldCaptureBrowserEvidence(result: {
  ok: boolean;
  errorCode?: string;
  hasScreenshot: boolean;
}): boolean {
  if (!result.hasScreenshot) {
    return false;
  }
  return (
    result.ok || result.errorCode === "AUTOMATION_BLOCKED" || result.errorCode === "AUTH_REQUIRED"
  );
}

export interface CaptureEvidenceParams {
  runId: string;
  portalId: string;
  pageObservationId: string;
  sourceUrl: string;
  screenshot: Buffer;
  description: string;
  capturedAt: string;
  evidenceOutDir: string;
}

export function writeScreenshotEvidence(params: CaptureEvidenceParams): EvidenceArtifact {
  const relativeDir = join(params.runId, params.portalId);
  const relativePath = join(relativeDir, `${params.pageObservationId}.png`);
  const absoluteDir = join(params.evidenceOutDir, relativeDir);
  mkdirSync(absoluteDir, { recursive: true });
  const absolutePath = join(params.evidenceOutDir, relativePath);
  writeFileSync(absolutePath, params.screenshot);

  const contentDigest = createHash("sha256").update(params.screenshot).digest("hex");

  return {
    id: `${params.pageObservationId}-evidence-screenshot`,
    schemaVersion: SCHEMA_VERSIONS.evidenceArtifact,
    runId: params.runId,
    portalId: params.portalId,
    type: "screenshot",
    capturedAt: params.capturedAt,
    sourceUrl: params.sourceUrl,
    relatedObservationId: params.pageObservationId,
    storagePath: relativePath,
    contentDigest,
    mimeType: "image/png",
    description: params.description,
    privacyReviewed: false,
  };
}
