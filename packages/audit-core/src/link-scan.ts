/**
 * Minimal outbound-link discovery for the crawl frontier — the Session 4/5
 * boundary decision documented in implementation.md's session brief and in
 * docs/session-log.md "Session 4": full HTML extraction (title, canonical,
 * language, anchor text, link context — implementation.md section 14
 * Session 5) is deliberately NOT built here. This module does the smallest
 * possible thing the frontier needs to walk depth 0..maxDepth: pull every
 * `<a href="...">` value out of an HTML document as a raw string, so the
 * crawler has candidate URLs to normalize/scope-check/enqueue.
 *
 * Deliberately a regex scan, not a DOM parser (Cheerio, already a
 * dependency in `packages/audit-cli`, is reserved for Session 5's full
 * extraction) — this keeps the audit-core package dependency-free and
 * keeps the boundary between "minimal frontier-walking" and "real
 * extraction" visible in the code, not just in prose. It is intentionally
 * best-effort: it will miss href values injected only via JavaScript
 * (Session 6's concern) and does not resolve `<base href>` (Session 5's
 * concern) — callers resolve each returned href against the page's own URL.
 */

const HREF_PATTERN = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** Extracts raw (unresolved, unnormalized) href attribute values from every
 * `<a href="...">` tag in `html`. Returns them in document order,
 * duplicates included — the caller (frontier.ts) is responsible for
 * normalizing and deduplicating. Never throws. */
export function extractRawHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(HREF_PATTERN)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value !== undefined && value.trim().length > 0) {
      hrefs.push(value.trim());
    }
  }
  return hrefs;
}
