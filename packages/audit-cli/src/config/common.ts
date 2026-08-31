import { z } from "zod";
import { nonEmptyString, schemaVersionField, stableId } from "@panchnama/schema";

/**
 * Config-schema location note
 * ---------------------------------------------------------------------------
 * These schemas validate the *configuration surface* the audit CLI reads
 * from `config/*.yaml` (implementation.md sections 6, 7, 9). They are
 * deliberately NOT added to `packages/schema`, even though they reuse its
 * primitives (`stableId`, `urlString`, `nonEmptyString`, `schemaVersionField`).
 *
 * Reasoning (see docs/session-log.md "Session 2" for the full writeup):
 *   - `packages/schema` documents itself as "shared Zod schemas ... for
 *     every domain record defined in implementation.md section 5" — i.e.
 *     the stored/published entity model. Crawl policy, check thresholds,
 *     and the source registry are operational configuration for the CLI
 *     pipeline (sections 6, 7, 9), not section-5 domain records.
 *   - Nothing outside `packages/audit-cli` currently needs to read this
 *     configuration (the web app consumes published data, not raw config).
 *     Keeping it CLI-local avoids growing the shared package with a second,
 *     unrelated kind of schema "just in case" a future package needs it.
 *   - If a later session needs these shapes from another package (e.g. the
 *     web app rendering "current crawl policy" on the methodology page),
 *     promote them to `packages/schema/src/config/` at that point rather
 *     than pre-emptively duplicating today.
 */

/** HTTP(S)-only URL string. Stricter than `@panchnama/schema`'s general
 * `urlString`, per section 6.1 ("Crawl only HTTP and HTTPS URLs") and this
 * session's semantic-validation requirement ("all URLs well-formed and
 * http(s) only"). */
export const httpUrlString = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: "url must use the http or https scheme" },
  );

/** Only geography currently supported (matches `Portal.geography` in
 * `@panchnama/schema`, which is typed as the literal `"assam"`). */
export const supportedGeographySchema = z.literal("assam");

export { nonEmptyString, schemaVersionField, stableId };
