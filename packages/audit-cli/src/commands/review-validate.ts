import { reviewValidate } from "../review/validate.js";
import type { ReviewPaths } from "../review/paths.js";

export interface ReviewValidateCommandParams {
  runId: string;
  analysisOutDir: string;
  crawlOutDir: string;
  inventoryOutDir: string;
  reviewPaths: ReviewPaths;
}

export interface ReviewValidateCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

/**
 * `pnpm run audit review:validate --run-id <id>` — implementation.md
 * section 9.1, section 14 Session 8. Always prints the "findings awaiting
 * review" queue first (this session's required "CLI output listing
 * findings awaiting review"), then every cross-record publication-gate
 * issue. Exits non-zero on any issue.
 */
export function runReviewValidateCommand(
  params: ReviewValidateCommandParams,
): ReviewValidateCommandOutput {
  const loaded = reviewValidate(params);
  if (!loaded.ok) {
    return { exitCode: 1, lines: ["review:validate FAILED", ...loaded.lines] };
  }
  const { result } = loaded;

  const lines: string[] = [];
  lines.push(`review:validate run: ${params.runId}`);
  lines.push(`candidate findings: ${result.bundle.findings.length}`);
  lines.push(`findings awaiting review: ${result.awaitingReview.length}`);
  if (result.awaitingReview.length > 0) {
    lines.push("");
    lines.push("--- Findings awaiting review ---");
    for (const f of [...result.awaitingReview].sort((a, b) => a.id.localeCompare(b.id))) {
      lines.push(
        `  ${f.id} | portal=${f.portalId} | rule=${f.ruleId} | severity=${f.severity} | "${f.summary}"`,
      );
    }
  }

  const publishCount = Array.from(result.decisionsByFindingId.values()).filter(
    (d) => d.decision === "publish",
  ).length;
  const rejectCount = Array.from(result.decisionsByFindingId.values()).filter(
    (d) => d.decision === "reject",
  ).length;
  const needsMoreCount = Array.from(result.decisionsByFindingId.values()).filter(
    (d) => d.decision === "needs_more_evidence",
  ).length;
  lines.push("");
  lines.push(
    `decisions recorded: ${result.decisionsByFindingId.size} (publish=${publishCount}, reject=${rejectCount}, needs_more_evidence=${needsMoreCount})`,
  );
  lines.push(
    `findings eligible for publication (passed every gate): ${result.publishableFindingIds.size}`,
  );

  if (result.issues.length > 0) {
    lines.push("");
    lines.push(`--- ${result.issues.length} issue(s) ---`);
    for (const issue of result.issues) {
      lines.push(
        `  [${issue.code}]${issue.findingId ? ` (${issue.findingId})` : ""} ${issue.message}`,
      );
    }
  }

  lines.push("");
  lines.push(result.ok ? "review:validate PASSED" : "review:validate FAILED");

  return { exitCode: result.ok ? 0 : 1, lines };
}
