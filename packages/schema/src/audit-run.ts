import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId } from "./common.js";

const auditRunStatusSchema = z.enum(["running", "completed", "partial", "failed"]);

const auditRunBaseSchema = z.object({
  id: stableId, // e.g. assam-2026-09-15-r1
  geography: z.literal("assam"),
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.optional(),
  status: auditRunStatusSchema,
  methodologyVersion: nonEmptyString,
  schemaVersion: schemaVersionField,
  codeRevision: z.string().optional(),
  nodeVersion: nonEmptyString,
  packageVersionsDigest: nonEmptyString,
  sourceRegistryDigest: nonEmptyString,
  crawlPolicyDigest: nonEmptyString,
  checkConfigDigest: nonEmptyString,
  enabledChecks: z.array(nonEmptyString),
  portalCount: z.number().int().nonnegative(),
  portalsSucceeded: z.number().int().nonnegative(),
  portalsFailed: z.number().int().nonnegative(),
  portalsPartial: z.number().int().nonnegative(),
  limitations: z.array(z.string()),
});

/**
 * Section 5.4. Top-level stored record — carries `schemaVersion` (shown
 * explicitly in the spec's interface for this entity).
 *
 * Invariants from §5.14 enforced here (all checkable from this record's own
 * fields):
 *   - `portalsSucceeded + portalsFailed + portalsPartial === portalCount`.
 *   - `completedAt` is required once the run reaches a terminal status
 *     (`completed`, `partial`, or `failed`); `running` may omit it.
 *   - `completed` / `partial` / `failed` must be consistent with the
 *     counts: `completed` means every portal succeeded; `failed` means none
 *     did; `partial` means a mix (some succeeded, and at least one did not).
 *     This specific derivation rule is this package's interpretation of the
 *     spec's "must be derived consistently from those counts" — documented
 *     here since the spec does not spell out the exact boundary.
 */
export const auditRunSchema = auditRunBaseSchema.strict().superRefine((run, ctx) => {
  const sum = run.portalsSucceeded + run.portalsFailed + run.portalsPartial;
  if (sum !== run.portalCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["portalCount"],
      message: `portalsSucceeded + portalsFailed + portalsPartial (${sum}) must equal portalCount (${run.portalCount})`,
    });
  }

  if (run.status !== "running" && run.completedAt === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completedAt"],
      message: `completedAt is required once status is "${run.status}" (terminal statuses require a completion time)`,
    });
  }

  const allSucceeded = run.portalsSucceeded === run.portalCount && run.portalCount > 0;
  const noneSucceeded = run.portalsSucceeded === 0 && run.portalCount > 0;

  if (run.status === "completed" && !allSucceeded) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message:
        'status "completed" requires portalsSucceeded === portalCount (no failures or partials)',
    });
  }
  if (run.status === "failed" && !noneSucceeded) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: 'status "failed" requires portalsSucceeded === 0',
    });
  }
  if (run.status === "partial" && (allSucceeded || noneSucceeded)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message:
        'status "partial" requires a mix of outcomes (some portals succeeded and at least one did not)',
    });
  }
});

export type AuditRun = z.infer<typeof auditRunSchema>;
