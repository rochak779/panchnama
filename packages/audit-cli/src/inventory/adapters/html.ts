import * as cheerio from "cheerio";
import type { AdapterResult, PortalCandidateReference, RejectedCandidate } from "../candidate.js";

export interface HtmlAdapterContext {
  sourceId: string;
  discoveredFromUrl: string;
  discoveryMethod: "listed" | "outbound_link" | "manual";
}

/**
 * HTML seed adapter — implementation.md section 14 Session 3: "parse a
 * directory-style HTML page ... extract candidate portal links + labels
 * (e.g. `<a>` tag text as name, `href` as candidate URL)."
 *
 * Extracts every `<a href="...">` in the document. `href` is preserved
 * exactly as written (may be relative — resolved later during
 * normalization, not here) as the candidate's `url`; the anchor's trimmed
 * text content becomes `name`. Anchors with no `href` attribute are not
 * candidates (nothing to extract) and are silently skipped, matching how
 * a human reading the page would treat plain non-link text. Anchors with
 * an empty-string or whitespace-only `href`, or no usable name text, are
 * reported as rejected rather than silently dropped, per this session's
 * "malformed/incomplete entries must be flagged" requirement.
 */
export function parseHtmlSeed(html: string, context: HtmlAdapterContext): AdapterResult {
  const $ = cheerio.load(html);
  const candidates: PortalCandidateReference[] = [];
  const rejected: RejectedCandidate[] = [];

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href") ?? "";
    const name = $(element).text().trim();
    const rawEntry = { href, name };

    if (href.trim().length === 0) {
      rejected.push({ sourceId: context.sourceId, raw: rawEntry, reason: "empty href attribute" });
      return;
    }
    if (name.length === 0) {
      rejected.push({
        sourceId: context.sourceId,
        raw: rawEntry,
        reason: "anchor has a href but no usable link text for a name",
      });
      return;
    }

    candidates.push({
      name,
      url: href,
      discoveredFromUrl: context.discoveredFromUrl,
      discoveryMethod: context.discoveryMethod,
      sourceId: context.sourceId,
    });
  });

  return { candidates, rejected };
}
