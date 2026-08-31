import { z } from "zod";
import {
  httpUrlString,
  nonEmptyString,
  schemaVersionField,
  stableId,
  supportedGeographySchema,
} from "./common.js";

/**
 * `config/sources.assam.yaml` schema.
 *
 * This mirrors `InventorySource` (implementation.md section 5.2, defined in
 * `@panchnama/schema`) but is a distinct, narrower shape: config declares
 * *intent to use a source* (where to look), while `InventorySource` is the
 * *record produced by ingesting one* (what was actually retrieved). See
 * "Source snapshot metadata conventions" below for the full mapping.
 *
 * Deliberately omitted vs. `InventorySource`:
 *   - `retrievedAt` — stamped by ingestion (Session 3) when the source is
 *     actually fetched/verified, not authored here.
 *   - `evidencePath` — populated by ingestion once a retrieval snapshot
 *     exists on disk; no fetch happens in this session.
 *
 * Added vs. `InventorySource`:
 *   - `enabled` — lets a non-engineer disable a source (e.g. found to be
 *     wrong, or temporarily excluded) without deleting its entry or losing
 *     its history in version control.
 */
export const sourceEntrySchema = z
  .object({
    id: stableId,
    name: nonEmptyString,
    authorityName: nonEmptyString,
    url: httpUrlString,
    sourceType: z.enum(["official_directory", "official_page", "manual_verified"]),
    enabled: z.boolean().default(true),
    notes: z.string().optional(),
  })
  .strict();

export type SourceEntry = z.infer<typeof sourceEntrySchema>;

export const sourceRegistryConfigSchema = z
  .object({
    schemaVersion: schemaVersionField,
    geography: supportedGeographySchema,
    sources: z.array(sourceEntrySchema).min(1, "sources must contain at least one entry"),
  })
  .strict();

export type SourceRegistryConfig = z.infer<typeof sourceRegistryConfigSchema>;

/**
 * Semantic validation beyond shape: no duplicate `id` values across
 * sources. (Shape/URL/geography validity is already enforced by the Zod
 * schema above; this catches the one cross-entry rule Zod can't express
 * declaratively without a `.refine` that loses per-item error paths.)
 */
export function findDuplicateSourceIds(config: SourceRegistryConfig): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const source of config.sources) {
    if (seen.has(source.id)) {
      duplicates.add(source.id);
    }
    seen.add(source.id);
  }
  return [...duplicates];
}
