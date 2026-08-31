import { runAnalyze, type RunAnalyzeParams } from "../analyze/run.js";

/**
 * `pnpm run audit analyze --run-id <id>` — implementation.md section 9.1,
 * section 14 Session 7.
 */
export interface AnalyzeCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

export async function runAnalyzeCommand(params: RunAnalyzeParams): Promise<AnalyzeCommandOutput> {
  const result = await runAnalyze(params);
  if (!result.ok) {
    return { exitCode: 1, lines: ["analyze FAILED", ...result.lines] };
  }
  return { exitCode: 0, lines: result.lines };
}
