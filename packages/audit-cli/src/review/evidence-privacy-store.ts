import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { isoTimestamp, nonEmptyString, stableId } from "@panchnama/schema";

/**
 * Evidence-privacy-review overlay — documented design point for this
 * session (see the Session 8 task brief, point 3).
 *
 * Raw `EvidenceArtifact` records materialized by `analyze` live in
 * `data/raw/analysis/<runId>/evidence-artifacts.jsonl` with
 * `privacyReviewed: false` on every one, and that file must stay immutable
 * generated output — it is regenerated wholesale by a rerun of `analyze`,
 * so nothing durable can be written back into it. But §8.3 item 3 requires
 * `privacyReviewed: true` on every artifact a published finding cites, and
 * that can only become true through an actual human privacy review (§12.2).
 *
 * Resolution: privacy-review decisions are recorded as a small overlay
 * record, one file per artifact, under `data/review/evidence-privacy/
 * <artifactId>.json` — parallel in spirit and location to the finding
 * review-decision store. At publish time, an artifact's EFFECTIVE
 * `privacyReviewed` value is:
 *
 *   raw.privacyReviewed === true
 *   || (overlay exists && overlay.privacyReviewed === true)
 *
 * The raw record itself is never mutated; the overlay is the durable,
 * separately-stored human decision, exactly mirroring how `ReviewDecision`
 * overlays a `Finding` without mutating the original.
 *
 * This is a small locally-defined schema (not added to `@panchnama/schema`)
 * because it is an internal editorial-workflow record of this pipeline
 * stage, not a domain entity from implementation.md section 5.
 */
export const evidencePrivacyReviewSchema = z
  .object({
    schemaVersion: z.string().min(1),
    artifactId: stableId,
    privacyReviewed: z.boolean(),
    privacyReviewedAt: isoTimestamp,
    privacyReviewer: nonEmptyString,
    redactions: z.array(z.string()).optional(),
    note: z.string().optional(),
  })
  .strict();

export type EvidencePrivacyReview = z.infer<typeof evidencePrivacyReviewSchema>;

export interface LoadedPrivacyReview {
  file: string;
  artifactId: string;
  review?: EvidencePrivacyReview;
  parseError?: string;
}

export function loadAllEvidencePrivacyReviews(evidencePrivacyDir: string): LoadedPrivacyReview[] {
  if (!existsSync(evidencePrivacyDir)) {
    return [];
  }
  const files = readdirSync(evidencePrivacyDir).filter((f) => f.endsWith(".json"));
  const out: LoadedPrivacyReview[] = [];
  for (const file of files) {
    const fullPath = join(evidencePrivacyDir, file);
    const artifactIdFromName = file.slice(0, -".json".length);
    try {
      const raw = JSON.parse(readFileSync(fullPath, "utf8"));
      const parsed = evidencePrivacyReviewSchema.safeParse(raw);
      if (!parsed.success) {
        out.push({
          file: fullPath,
          artifactId: artifactIdFromName,
          parseError: parsed.error.message,
        });
        continue;
      }
      if (parsed.data.artifactId !== artifactIdFromName) {
        out.push({
          file: fullPath,
          artifactId: artifactIdFromName,
          parseError: `file name "${file}" does not match artifactId "${parsed.data.artifactId}" inside it`,
        });
        continue;
      }
      out.push({ file: fullPath, artifactId: parsed.data.artifactId, review: parsed.data });
    } catch (error) {
      out.push({
        file: fullPath,
        artifactId: artifactIdFromName,
        parseError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return out;
}

export function writeEvidencePrivacyReview(
  evidencePrivacyDir: string,
  review: EvidencePrivacyReview,
  overwrite = false,
): { path: string } {
  mkdirSync(evidencePrivacyDir, { recursive: true });
  const path = join(evidencePrivacyDir, `${review.artifactId}.json`);
  if (existsSync(path) && !overwrite) {
    throw new Error(
      `refusing to overwrite existing evidence-privacy review at "${path}" — pass an explicit override.`,
    );
  }
  writeFileSync(path, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  return { path };
}
