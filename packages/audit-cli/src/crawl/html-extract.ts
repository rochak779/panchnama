import * as cheerio from "cheerio";

/**
 * Full HTML page extraction — implementation.md section 14 Session 5,
 * replacing `@panchnama/audit-core`'s minimal `extractRawHrefs` regex scan
 * (see that module's doc comment for the Session 4/5 boundary this closes)
 * as the frontier's source of truth for "what does this page link to."
 *
 * Lives in `packages/audit-cli` (not `audit-core`) because it depends on
 * Cheerio, a real DOM parser — `audit-core` is deliberately kept
 * dependency-free (see `link-scan.ts`'s doc comment). `link-scan.ts`
 * itself is left untouched/unused-by-the-frontier rather than deleted: it
 * remains a documented, superseded building block, per the task brief.
 *
 * Base-tag awareness: every relative URL (canonical, every `<a href>`) is
 * resolved against `<base href>` when present, falling back to the page's
 * own URL otherwise — this is exactly what the regex scanner explicitly
 * did not do. Cheerio decodes HTML entities in attribute values (e.g.
 * `&amp;` -> `&`) as part of ordinary HTML parsing, so entity-encoded
 * hrefs resolve correctly for free; percent-encoding is preserved as-is
 * and handled by the WHATWG `URL` constructor used for resolution.
 *
 * "Context" (bounded, per `LinkObservation.context?`): defined concretely
 * here as the trimmed, whitespace-collapsed text content of the anchor's
 * immediate parent element, truncated to `MAX_TEXT_LENGTH` characters —
 * cheap to compute, and gives a human enough surrounding text to see where
 * on the page a link sat without storing unbounded page content.
 */

export interface ExtractedLink {
  /** The href attribute exactly as written in the source HTML (trimmed). */
  rawHref: string;
  /** Absolute URL resolved against `<base>`/page URL, or `undefined` if
   * the href could not be parsed as a URL at all (e.g. genuinely
   * malformed). Callers must not attempt to check a link with no
   * `resolvedUrl`. */
  resolvedUrl?: string;
  anchorText?: string;
  context?: string;
}

export interface ExtractedPage {
  title?: string;
  canonical?: string;
  language?: string;
  links: ExtractedLink[];
}

const MAX_TEXT_LENGTH = 200;

function truncate(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_TEXT_LENGTH
    ? `${collapsed.slice(0, MAX_TEXT_LENGTH - 1)}…`
    : collapsed;
}

function resolveUrl(href: string, base: string): string | undefined {
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

/** Parses `html` (Cheerio is lenient — unclosed tags, missing quotes, and
 * other malformed markup never throw) and extracts title/canonical/
 * language/links relative to `pageUrl`. Never throws. */
export function extractHtml(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const rawBaseHref = $("base[href]").first().attr("href");
  const effectiveBase =
    rawBaseHref !== undefined ? (resolveUrl(rawBaseHref, pageUrl) ?? pageUrl) : pageUrl;

  const titleText = $("title").first().text();
  const title = titleText.trim().length > 0 ? truncate(titleText) : undefined;

  const canonicalHref = $('link[rel="canonical"]').first().attr("href");
  const canonical =
    canonicalHref !== undefined ? resolveUrl(canonicalHref.trim(), effectiveBase) : undefined;

  const langAttr = $("html").first().attr("lang");
  const metaLang = $('meta[http-equiv="content-language" i]').first().attr("content");
  const languageRaw = (langAttr ?? metaLang ?? "").trim();
  const language = languageRaw.length > 0 ? languageRaw : undefined;

  const links: ExtractedLink[] = [];
  $("a[href]").each((_index, element) => {
    const el = $(element);
    const rawHrefAttr = el.attr("href");
    if (rawHrefAttr === undefined || rawHrefAttr.trim().length === 0) {
      return;
    }
    const rawHref = rawHrefAttr.trim();
    const resolvedUrl = resolveUrl(rawHref, effectiveBase);
    const anchorTextRaw = el.text();
    const anchorText = anchorTextRaw.trim().length > 0 ? truncate(anchorTextRaw) : undefined;
    const parentTextRaw = el.parent().text();
    const context = parentTextRaw.trim().length > 0 ? truncate(parentTextRaw) : undefined;
    links.push({
      rawHref,
      ...(resolvedUrl !== undefined ? { resolvedUrl } : {}),
      ...(anchorText !== undefined ? { anchorText } : {}),
      ...(context !== undefined ? { context } : {}),
    });
  });

  return {
    ...(title !== undefined ? { title } : {}),
    ...(canonical !== undefined ? { canonical } : {}),
    ...(language !== undefined ? { language } : {}),
    links,
  };
}
