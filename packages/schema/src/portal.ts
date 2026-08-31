import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId, urlString } from "./common.js";
import { officialStatusSchema } from "./enums.js";

/**
 * Section 5.3. Embedded discovery-provenance entry — not a top-level
 * record, so it does not carry its own `schemaVersion` (see common.ts).
 */
const portalDiscoveryEntrySchema = z
  .object({
    discoveredAt: isoTimestamp,
    discoveredFromUrl: urlString,
    discoveryMethod: z.enum(["listed", "outbound_link", "manual"]),
  })
  .strict();

/** Section 5.3. Top-level stored record — carries `schemaVersion`. */
export const portalSchema = z
  .object({
    id: stableId,
    schemaVersion: schemaVersionField,
    name: nonEmptyString,
    canonicalUrl: urlString,
    alternateUrls: z.array(urlString),
    hostnames: z.array(nonEmptyString),
    description: z.string().optional(),
    department: z.string().optional(),
    geography: z.literal("assam"),
    portalType: z.enum(["information", "transactional", "directory", "mixed", "unknown"]),
    officialStatus: officialStatusSchema,
    sourceRefs: z.array(stableId),
    discovery: z.array(portalDiscoveryEntrySchema),
    tags: z.array(z.string()),
    crawlProfile: z.string().optional(),
  })
  .strict();

export type Portal = z.infer<typeof portalSchema>;

// TODO(session-3/8): "A published portal must reference at least one
// inventory source" (implementation.md §5.14) needs the actual
// InventorySource records that `sourceRefs` points to — it cannot be
// checked from a Portal object alone. `sourceRefs.length >= 1` (a weaker,
// single-record-checkable stand-in) is intentionally NOT enforced here
// either, since a candidate/unverified portal record may legitimately be
// mid-ingestion before its sources are attached; the real invariant belongs
// to the ingestion/publish pipeline that has the InventorySource set to
// check against.
