/**
 * Crawl run ID derivation — implementation.md's example `assam-2026-09-15-r1`
 * (section 5.4). When the caller doesn't pass `--run-id` explicitly, this
 * picks the first free `assam-<UTC-date>-r<n>` slot for today, so repeated
 * runs on the same day get `r1`, `r2`, ... rather than colliding.
 */
export function defaultCrawlRunId(nowIso: string, existingRunIds: ReadonlySet<string>): string {
  const date = nowIso.slice(0, 10);
  let n = 1;
  while (existingRunIds.has(`assam-${date}-r${n}`)) {
    n += 1;
  }
  return `assam-${date}-r${n}`;
}
