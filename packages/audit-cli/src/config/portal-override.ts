import { z } from "zod";
import { nonEmptyString, schemaVersionField, stableId } from "./common.js";

/**
 * `config/portals/<portal-id>.yaml` schema — one file per portal, holding
 * per-portal overrides of `crawl-policy.yaml` defaults. Referenced by
 * `Portal.crawlProfile` (a free-text string in `@panchnama/schema`) which
 * later sessions can resolve to a filename under `config/portals/`.
 *
 * No `Portal` records exist until Session 3, so this session validates
 * override *files* for internal consistency and correct shape only. It does
 * NOT check that `portalId` resolves to a real portal — that cross-record
 * check is deferred (see docs/session-log.md "Known limitations").
 *
 * Every field is optional: an override file only needs to specify the
 * settings it changes from the crawl-policy default.
 */
export const portalOverrideConfigSchema = z
  .object({
    schemaVersion: schemaVersionField,
    portalId: stableId,
    overrides: z
      .object({
        maxPagesPerPortal: z.number().int().positive().optional(),
        maxDepth: z.number().int().min(0).optional(),
        browserFallbackEnabled: z.boolean().optional(),
        additionalExcludedPathPatterns: z.array(nonEmptyString).optional(),
        disabled: z.boolean().optional(),
      })
      .strict()
      .refine((overrides) => Object.keys(overrides).length > 0, {
        message: "overrides must specify at least one setting, or the file should be removed",
      }),
  })
  .strict();

export type PortalOverrideConfig = z.infer<typeof portalOverrideConfigSchema>;
