import { z } from "zod";
import { schemaVersionField, stableId } from "./common.js";

/**
 * `config/checks.yaml` schema — implementation.md section 7.
 *
 * Rule *logic* doesn't exist until Session 7, so this only describes which
 * checks are enabled and their tunable parameters. `ruleId` is validated as
 * a `stableId`-shaped string (matches the `namespace.condition.vN` pattern
 * used by section 7.1's examples, e.g. `availability.unavailable.v1`) rather
 * than an exhaustive enum of every rule Session 7 will eventually add —
 * validating structure, not a closed rule catalog, per this session's brief.
 *
 * `parameters` is a generic record of tunable thresholds per rule (e.g.
 * `spacedAttempts` for `availability.unavailable.v1`). Session 7 is
 * responsible for validating that a given rule's parameters match what its
 * implementation expects; this session only validates that parameters are a
 * well-formed key/value object.
 */
export const checkEntrySchema = z
  .object({
    ruleId: stableId,
    enabled: z.boolean(),
    parameters: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type CheckEntry = z.infer<typeof checkEntrySchema>;

export const checksConfigSchema = z
  .object({
    schemaVersion: schemaVersionField,
    checks: z.array(checkEntrySchema).min(1, "checks must contain at least one entry"),
  })
  .strict();

export type ChecksConfig = z.infer<typeof checksConfigSchema>;

/** Semantic validation: no duplicate `ruleId` values across checks. */
export function findDuplicateRuleIds(config: ChecksConfig): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const check of config.checks) {
    if (seen.has(check.ruleId)) {
      duplicates.add(check.ruleId);
    }
    seen.add(check.ruleId);
  }
  return [...duplicates];
}
