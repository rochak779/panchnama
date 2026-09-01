/**
 * Bounded free-text normalization (implementation.md section 9.6, step 6:
 * "Normalize bounded free text; never accept HTML").
 *
 * Exact behavior, documented so it is easy to audit:
 * 1. Strip anything that looks like an HTML tag (`<...>`) — a whole-tag
 *    removal, not an escape/encode. HTML is never accepted as-is; this
 *    session chooses to strip tags (keep the surrounding human-readable
 *    text) rather than reject the entire submission outright, since a
 *    citizen pasting text from a rich-text source (e.g. copying from a
 *    webpage) with incidental markup is a more likely, more sympathetic
 *    case than a deliberate injection attempt, and the field is stored as
 *    plain text in a `varchar` column, never rendered as HTML downstream,
 *    so a stripped tag cannot resurface as executable markup later.
 * 2. Trim leading/trailing whitespace.
 * 3. Collapse runs of internal whitespace (spaces, tabs, newlines) to a
 *    single space, since free-form pasted text often carries irregular
 *    line breaks that add no meaning once redacted/published.
 *
 * Returns `null` for `null`/`undefined`/empty-after-normalization input,
 * matching the schema's optional-field convention (an empty string is not
 * stored as a distinct value from "absent").
 */
export function normalizeBoundedText(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;
  const withoutTags = text.replace(/<[^>]*>/g, " ");
  const collapsed = withoutTags.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? collapsed : null;
}
