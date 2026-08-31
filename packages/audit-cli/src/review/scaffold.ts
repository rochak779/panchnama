import type { Severity, SuggestedAction } from "@panchnama/schema";
import { SCHEMA_VERSIONS, reviewDecisionSchema } from "@panchnama/schema";
import { loadRunBundle } from "./load-run.js";
import { writeDecisionFile } from "./decision-store.js";
import type { ReviewPaths } from "./paths.js";

/**
 * `review:scaffold` — the small CLI helper for authoring one
 * `ReviewDecision` file (Session 8 task brief, point 1). Looks up the
 * named finding in the given run so the reviewer sees its original
 * severity/summary for context, then writes a decision file pre-filled
 * with everything known automatically, leaving `decision`/`rationale` (and
 * optional overrides) for a human to fill in or confirm before it can pass
 * `review:validate`.
 */
export function scaffoldReviewDecision(params: {
  runId: string;
  findingId: string;
  analysisOutDir: string;
  crawlOutDir: string;
  inventoryOutDir: string;
  reviewPaths: ReviewPaths;
  decision: "publish" | "reject" | "needs_more_evidence";
  reviewer: string;
  rationale?: string;
  overriddenSeverity?: Severity;
  overriddenAction?: SuggestedAction;
  now?: () => string;
  overwrite?: boolean;
}): { ok: true; path: string; lines: string[] } | { ok: false; lines: string[] } {
  const loaded = loadRunBundle({
    runId: params.runId,
    analysisOutDir: params.analysisOutDir,
    crawlOutDir: params.crawlOutDir,
    inventoryOutDir: params.inventoryOutDir,
  });
  if (!loaded.ok) {
    return { ok: false, lines: loaded.lines };
  }
  const finding = loaded.bundle.findings.find((f) => f.id === params.findingId);
  if (finding === undefined) {
    return {
      ok: false,
      lines: [`no finding "${params.findingId}" found in run "${params.runId}".`],
    };
  }

  const now = params.now ?? (() => new Date().toISOString());
  const decision = reviewDecisionSchema.safeParse({
    schemaVersion: SCHEMA_VERSIONS.reviewDecision,
    findingId: finding.id,
    decision: params.decision,
    reviewedAt: now(),
    reviewer: params.reviewer,
    rationale: params.rationale ?? "TODO: fill in rationale before this decision is authoritative.",
    ...(params.overriddenSeverity !== undefined
      ? { overriddenSeverity: params.overriddenSeverity }
      : {}),
    ...(params.overriddenAction !== undefined ? { overriddenAction: params.overriddenAction } : {}),
  });
  if (!decision.success) {
    return {
      ok: false,
      lines: [`scaffolded decision failed schema validation: ${decision.error.message}`],
    };
  }

  try {
    const { path } = writeDecisionFile(
      params.reviewPaths.decisionsDir,
      decision.data,
      params.overwrite ?? false,
    );
    return {
      ok: true,
      path,
      lines: [
        `scaffolded review decision for finding "${finding.id}" (${finding.ruleId}, original severity=${finding.severity}, summary="${finding.summary}") at ${path}`,
        `edit the file to finalize the rationale (and any overrides) before running review:validate.`,
      ],
    };
  } catch (error) {
    return { ok: false, lines: [error instanceof Error ? error.message : String(error)] };
  }
}
