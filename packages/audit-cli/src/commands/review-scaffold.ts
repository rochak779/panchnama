import { scaffoldReviewDecision } from "../review/scaffold.js";
import type { ReviewPaths } from "../review/paths.js";
import type { Severity, SuggestedAction } from "@panchnama/schema";

export interface ReviewScaffoldCommandParams {
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
  overwrite?: boolean;
}

export interface ReviewScaffoldCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

/** `pnpm run audit review:scaffold --run-id <id> --finding-id <id>
 * --decision <publish|reject|needs_more_evidence> --reviewer <name>` — the
 * small authoring helper for point 1 of this session's brief. */
export function runReviewScaffoldCommand(
  params: ReviewScaffoldCommandParams,
): ReviewScaffoldCommandOutput {
  const result = scaffoldReviewDecision(params);
  return { exitCode: result.ok ? 0 : 1, lines: result.lines };
}
