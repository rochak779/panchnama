import { runCrawl, type RunCrawlParams } from "../crawl/run.js";

/**
 * `pnpm run audit crawl --state assam --run-id <id>` (full run) and
 * `pnpm run audit crawl --portal <portal-id> --max-pages 5` (scoped dev
 * run) — implementation.md section 9.1, section 14 Session 4.
 */
export interface CrawlCommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

export async function runCrawlCommand(params: RunCrawlParams): Promise<CrawlCommandOutput> {
  const result = await runCrawl(params);
  if (!result.ok) {
    return { exitCode: 1, lines: ["crawl FAILED", ...result.lines] };
  }
  return { exitCode: 0, lines: result.lines };
}
