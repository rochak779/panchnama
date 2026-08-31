import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/**
 * `data/seed/source-inputs.json` — Session 3's fixture-wiring map from
 * `config/sources.assam.yaml` source IDs to a local seed input file and
 * format. See that file's own `_comment` field, and
 * docs/session-log.md "Session 3", for why this lives as a separate seed
 * file rather than as new fields on `config/sources.assam.yaml`.
 */
const seedInputEntrySchema = z
  .object({
    format: z.enum(["html", "json", "csv"]),
    path: z.string().min(1),
    discoveryMethod: z.enum(["listed", "outbound_link", "manual"]),
  })
  .strict();

const sourceInputsFileSchema = z
  .object({
    _comment: z.string().optional(),
    sources: z.record(seedInputEntrySchema),
  })
  .strict();

export type SeedInputEntry = z.infer<typeof seedInputEntrySchema>;
export type SourceInputsMap = Record<string, SeedInputEntry>;

export function loadSourceInputsMap(seedDir: string): SourceInputsMap {
  const filePath = join(seedDir, "source-inputs.json");
  const text = readFileSync(filePath, "utf8");
  const parsed = sourceInputsFileSchema.parse(JSON.parse(text));
  return parsed.sources;
}

/**
 * `data/seed/aliases.json` — manually reviewed URL alias mappings (section
 * 6.5's "reviewed aliases" dedup path). `from`/`to` are stored as authored
 * in the file; callers normalize both before use so exact original
 * casing/trailing-slash formatting in the file doesn't need to match a
 * candidate's normalized form exactly.
 */
const aliasEntrySchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const aliasesFileSchema = z
  .object({
    _comment: z.string().optional(),
    aliases: z.array(aliasEntrySchema),
  })
  .strict();

export type AliasEntry = z.infer<typeof aliasEntrySchema>;

export function loadAliases(seedDir: string): AliasEntry[] {
  const filePath = join(seedDir, "aliases.json");
  const text = readFileSync(filePath, "utf8");
  const parsed = aliasesFileSchema.parse(JSON.parse(text));
  return parsed.aliases;
}
