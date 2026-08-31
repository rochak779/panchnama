import { publishedPortalAssessmentSchema } from "@panchnama/schema";
import { reviewValidate } from "./validate.js";
import { transformToPublication } from "./transform.js";
import { writePublishedRunAtomic } from "./publish-write.js";
import type { ReviewPaths } from "./paths.js";

export interface RunPublishParams {
  runId: string;
  analysisOutDir: string;
  crawlOutDir: string;
  inventoryOutDir: string;
  reviewPaths: ReviewPaths;
  now?: () => string;
  overwrite?: boolean;
}

export type RunPublishResult =
  | { ok: true; outputDir: string; portalCount: number; lines: string[] }
  | { ok: false; lines: string[] };

/**
 * `pnpm run audit publish --run-id <id>` — implementation.md section 9.1,
 * section 14 Session 8: "publish ... runs `review:validate` first (refuse
 * to publish if it fails), then the publication transformer, writing
 * atomically." No interpretive finding can bypass review because `publish`
 * literally calls the same `reviewValidate` function `review:validate`
 * exposes standalone, and refuses to proceed on any issue.
 */
export async function runPublish(params: RunPublishParams): Promise<RunPublishResult> {
  const now = params.now ?? (() => new Date().toISOString());

  const validated = reviewValidate({
    runId: params.runId,
    analysisOutDir: params.analysisOutDir,
    crawlOutDir: params.crawlOutDir,
    inventoryOutDir: params.inventoryOutDir,
    reviewPaths: params.reviewPaths,
  });
  if (!validated.ok) {
    return { ok: false, lines: ["publish FAILED — could not load run", ...validated.lines] };
  }
  if (!validated.result.ok) {
    return {
      ok: false,
      lines: [
        "publish FAILED — review:validate did not pass. Fix these issues first:",
        ...validated.result.issues.map((i) => `  [${i.code}] ${i.message}`),
      ],
    };
  }

  const { assessments, summary } = transformToPublication(validated.result, {
    crawlOutDir: params.crawlOutDir,
    publishedAt: now(),
  });

  for (const assessment of assessments) {
    const check = publishedPortalAssessmentSchema.safeParse(assessment);
    if (!check.success) {
      return {
        ok: false,
        lines: [
          `publish FAILED — generated PublishedPortalAssessment for portal "${assessment.portal.id}" failed schema validation: ${check.error.message}`,
        ],
      };
    }
  }

  try {
    const { outputDir } = writePublishedRunAtomic({
      publishedDir: params.reviewPaths.publishedDir,
      runId: params.runId,
      assessments,
      summary,
      ...(params.overwrite !== undefined ? { overwrite: params.overwrite } : {}),
    });
    return {
      ok: true,
      outputDir,
      portalCount: assessments.length,
      lines: [
        `publish run: ${params.runId}`,
        `portals published: ${assessments.length}`,
        `technical health counts: ${JSON.stringify(summary.technicalHealthCounts)}`,
        `severity counts: ${JSON.stringify(summary.severityCounts)}`,
        `output: ${outputDir}`,
      ],
    };
  } catch (error) {
    return { ok: false, lines: [error instanceof Error ? error.message : String(error)] };
  }
}
