import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  linkObservationSchema,
  pageObservationSchema,
  type LinkObservation,
  type PageObservation,
} from "@panchnama/schema";

function readJsonl<T>(path: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(path)) {
    return [];
  }
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const values: T[] = [];
  for (const line of lines) {
    const parsed = schema.safeParse(JSON.parse(line));
    if (parsed.success) {
      values.push(parsed.data);
    }
  }
  return values;
}

export interface PortalCrawlCoverage {
  pagesAttempted: number;
  pagesObserved: number;
  linksChecked: number;
  browserFallbackUsed: boolean;
  coverageNote: string;
}

/**
 * Loads a portal's crawl-coverage numbers directly from the referenced
 * crawl run's `page-observations.jsonl`/`link-observations.jsonl` — the
 * same raw counts Session 7's `crawl_coverage.summary.v1` rule reasons
 * about, reused here (rather than re-parsing that rule's generated finding
 * text) for `PublishedPortalAssessment.crawlCoverage`.
 */
export function loadPortalCrawlCoverage(params: {
  crawlOutDir: string;
  crawlRunId: string;
  portalId: string;
}): PortalCrawlCoverage {
  const crawlRunDir = join(params.crawlOutDir, params.crawlRunId);
  const pageObs = readJsonl<PageObservation>(
    join(crawlRunDir, "page-observations.jsonl"),
    pageObservationSchema,
  ).filter((o) => o.portalId === params.portalId);
  const linkObs = readJsonl<LinkObservation>(
    join(crawlRunDir, "link-observations.jsonl"),
    linkObservationSchema,
  ).filter((o) => o.portalId === params.portalId);

  const pagesAttempted = pageObs.length;
  const pagesObserved = pageObs.filter((o) => o.errorCode === undefined).length;
  const linksChecked = linkObs.length;
  const browserFallbackUsed = pageObs.some((o) => o.fetchMode === "browser");

  const coverageNote =
    pagesAttempted === 0
      ? "No pages were attempted for this portal in the referenced crawl run."
      : `${pagesObserved} of ${pagesAttempted} attempted page check(s) returned a response; ${linksChecked} link(s) checked${browserFallbackUsed ? "; browser rendering fallback was used for at least one page" : ""}.`;

  return { pagesAttempted, pagesObserved, linksChecked, browserFallbackUsed, coverageNote };
}
