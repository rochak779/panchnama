import { z } from "zod";
import { isoTimestamp, nonEmptyString, schemaVersionField, stableId, urlString } from "./common.js";

/** Section 5.2. Top-level stored record — carries `schemaVersion`. */
export const inventorySourceSchema = z
  .object({
    id: stableId,
    schemaVersion: schemaVersionField,
    name: nonEmptyString,
    authorityName: nonEmptyString,
    url: urlString,
    sourceType: z.enum(["official_directory", "official_page", "manual_verified"]),
    retrievedAt: isoTimestamp,
    evidencePath: z.string().min(1).optional(),
    notes: z.string().optional(),
  })
  .strict();

export type InventorySource = z.infer<typeof inventorySourceSchema>;
