/**
 * Common intermediate shape produced by every seed adapter (HTML/JSON/CSV)
 * — implementation.md section 14 Session 3: "Each adapter's job is only to
 * produce a common intermediate 'candidate portal reference' shape ...
 * not the final `Portal` record yet."
 *
 * `url` is the ORIGINALLY OBSERVED URL exactly as written in the seed
 * input (may be relative, may be malformed) — normalization and merging
 * happen centrally afterward (see `../url.js`, `./merge.js`), never inside
 * an adapter, so every adapter behaves identically and the normalized
 * form is always derivable from, and traceable back to, what was actually
 * observed.
 */
export interface PortalCandidateReference {
  name: string;
  url: string;
  discoveredFromUrl: string;
  discoveryMethod: "listed" | "outbound_link" | "manual";
  sourceId: string;
  department?: string;
  portalType?: "information" | "transactional" | "directory" | "mixed" | "unknown";
  tags?: string[];
  notes?: string;
}

/**
 * A raw seed-input row/entry that an adapter could not turn into a usable
 * `PortalCandidateReference` (e.g. missing name/url, or a URL later found
 * malformed during normalization). Adapters emit these instead of
 * silently dropping bad rows, per this session's explicit requirement:
 * "Malformed URLs -> rejected/flagged, not silently dropped or silently
 * included."
 */
export interface RejectedCandidate {
  sourceId: string;
  raw: Record<string, unknown>;
  reason: string;
}

export type AdapterResult = {
  candidates: PortalCandidateReference[];
  rejected: RejectedCandidate[];
};
