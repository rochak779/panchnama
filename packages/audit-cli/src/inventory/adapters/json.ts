import { z } from "zod";
import type { AdapterResult, PortalCandidateReference, RejectedCandidate } from "../candidate.js";

export interface JsonAdapterContext {
  sourceId: string;
  discoveredFromUrl: string;
  discoveryMethod: "listed" | "outbound_link" | "manual";
}

/** One entry in a seed JSON file. Loosely typed on purpose — the adapter's
 * job is to validate and flag malformed entries itself, not delegate that
 * to a strict Zod parse that would abort the whole file on one bad row. */
const jsonEntrySchema = z.record(z.unknown());

/**
 * JSON seed adapter — implementation.md section 14 Session 3: "parse a
 * simple structured JSON seed file (an array of `{ name, url,
 * department?, ... }` objects) into candidates."
 *
 * Accepts either a bare top-level array of entries, or an object with an
 * `entries` array field (the shape used by
 * `data/seed/assam-directory-example.json`, which also carries a
 * `_comment` field documenting the fixture — any other top-level fields
 * are ignored). Each entry needs at least a non-empty `name` and `url`
 * string; entries missing either are rejected rather than silently
 * dropped. Recognized optional fields: `department`, `portalType`,
 * `tags` (array of strings), `notes`.
 */
export function parseJsonSeed(jsonText: string, context: JsonAdapterContext): AdapterResult {
  const candidates: PortalCandidateReference[] = [];
  const rejected: RejectedCandidate[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    rejected.push({
      sourceId: context.sourceId,
      raw: { text: jsonText.slice(0, 200) },
      reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { candidates, rejected };
  }

  let entries: unknown[];
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (
    parsed !== null &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).entries)
  ) {
    entries = (parsed as Record<string, unknown>).entries as unknown[];
  } else {
    rejected.push({
      sourceId: context.sourceId,
      raw: { text: jsonText.slice(0, 200) },
      reason: "expected a top-level array or an object with an 'entries' array field",
    });
    return { candidates, rejected };
  }

  for (const rawItem of entries) {
    const itemResult = jsonEntrySchema.safeParse(rawItem);
    if (!itemResult.success) {
      rejected.push({
        sourceId: context.sourceId,
        raw: { value: rawItem },
        reason: "entry is not an object",
      });
      continue;
    }
    const item = itemResult.data;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";

    if (name.length === 0 || url.length === 0) {
      rejected.push({
        sourceId: context.sourceId,
        raw: item,
        reason:
          name.length === 0 ? "entry missing a usable 'name'" : "entry missing a usable 'url'",
      });
      continue;
    }

    const candidate: PortalCandidateReference = {
      name,
      url,
      discoveredFromUrl: context.discoveredFromUrl,
      discoveryMethod: context.discoveryMethod,
      sourceId: context.sourceId,
    };
    if (typeof item.department === "string" && item.department.trim().length > 0) {
      candidate.department = item.department.trim();
    }
    if (
      typeof item.portalType === "string" &&
      ["information", "transactional", "directory", "mixed", "unknown"].includes(item.portalType)
    ) {
      candidate.portalType = item.portalType as
        "information" | "transactional" | "directory" | "mixed" | "unknown";
    }
    if (Array.isArray(item.tags) && item.tags.every((t) => typeof t === "string")) {
      candidate.tags = item.tags as string[];
    }
    if (typeof item.notes === "string" && item.notes.trim().length > 0) {
      candidate.notes = item.notes.trim();
    }

    candidates.push(candidate);
  }

  return { candidates, rejected };
}
