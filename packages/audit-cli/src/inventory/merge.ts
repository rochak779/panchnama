import { SCHEMA_VERSIONS, type OfficialStatus, type Portal } from "@panchnama/schema";
import { normalizeUrl, type UrlNormalizationOptions } from "@panchnama/audit-core";
import type { PortalCandidateReference, RejectedCandidate } from "./candidate.js";
import { derivePortalId } from "./id.js";

export type SourceType = "official_directory" | "official_page" | "manual_verified";

/** Source types that make a candidate's `officialStatus` default to
 * `verified` — implementation.md section 14 Session 3, point 6: "a
 * candidate discovered from a source explicitly marked
 * `sourceType: 'official_directory'` or `'official_page'` ... becomes
 * `verified`; anything else ... defaults to `unverified`." This is
 * deliberately narrower than "any configured source" — a
 * `manual_verified` source does not auto-verify a *candidate* here either;
 * see docs/session-log.md "Session 3" for the reasoning (that source type
 * exists for `InventorySource` records produced by a human-confirmed
 * process, which this session's fixture-driven build does not perform). */
const VERIFYING_SOURCE_TYPES: ReadonlySet<SourceType> = new Set([
  "official_directory",
  "official_page",
]);

export interface MergeInput {
  candidates: PortalCandidateReference[];
  sourceTypeById: Map<string, SourceType>;
  baseUrlById: Map<string, string>;
  normalizationOptions: UrlNormalizationOptions;
  /** Normalized-from-URL -> normalized-to-URL. Built by the caller from
   * `data/seed/aliases.json`, already normalized so lookups are exact. */
  aliasMap: Map<string, string>;
  nowIso: string;
}

export interface MergeOutput {
  portals: Portal[];
  /** Candidates whose URL failed normalization (malformed, unsupported
   * scheme, unresolvable relative URL) — flagged, never silently
   * dropped or silently included. */
  rejected: RejectedCandidate[];
}

interface GroupMember {
  candidate: PortalCandidateReference;
  ownNormalizedUrl: string;
  ownHostname: string;
  sourceType: SourceType;
}

/**
 * Normalizes every candidate, applies the manual alias map, groups
 * candidates whose final canonical URL matches, and merges each group into
 * one `Portal` record. Merging NEVER drops a `discovery` entry or a
 * `sourceRefs` entry — implementation.md section 14 Session 3's exit
 * criterion: "no candidate loses its source provenance."
 *
 * Conflicting-label policy (same canonical URL, different `name` values
 * across sources): the name from the first-seen candidate whose source is
 * `official_directory`/`official_page` wins; if no merged candidate came
 * from such a source, the first-seen candidate's name wins regardless of
 * order otherwise. Rationale: an officially-sourced label is more likely
 * accurate than one from an as-yet-unverified source, but in the absence
 * of any official label, "first seen" is the only deterministic tiebreak
 * available and is preferable to arbitrarily picking the "biggest" or
 * "longest" name.
 */
export function mergeCandidates(input: MergeInput): MergeOutput {
  const groups = new Map<string, GroupMember[]>();
  const rejected: RejectedCandidate[] = [];

  for (const candidate of input.candidates) {
    const base = input.baseUrlById.get(candidate.sourceId);
    const normResult = normalizeUrl(candidate.url, input.normalizationOptions, base);
    if (!normResult.ok) {
      rejected.push({
        sourceId: candidate.sourceId,
        raw: { name: candidate.name, url: candidate.url },
        reason: `URL normalization failed: ${normResult.reason}`,
      });
      continue;
    }

    const canonicalUrl = input.aliasMap.get(normResult.normalizedUrl) ?? normResult.normalizedUrl;
    const sourceType = input.sourceTypeById.get(candidate.sourceId) ?? "manual_verified";

    const member: GroupMember = {
      candidate,
      ownNormalizedUrl: normResult.normalizedUrl,
      ownHostname: normResult.hostname,
      sourceType,
    };

    const existing = groups.get(canonicalUrl);
    if (existing) {
      existing.push(member);
    } else {
      groups.set(canonicalUrl, [member]);
    }
  }

  const portals: Portal[] = [];
  for (const [canonicalUrl, members] of groups.entries()) {
    portals.push(buildPortal(canonicalUrl, members, input.nowIso));
  }

  return { portals, rejected };
}

function buildPortal(canonicalUrl: string, members: GroupMember[], nowIso: string): Portal {
  const verifyingMember = members.find((m) => VERIFYING_SOURCE_TYPES.has(m.sourceType));
  const nameSource = verifyingMember ?? members[0];
  const name = nameSource!.candidate.name;

  const department = members
    .map((m) => m.candidate.department)
    .find((d) => !!d && d.trim().length > 0);
  const portalType =
    members.map((m) => m.candidate.portalType).find((t) => !!t) ?? ("unknown" as const);

  const tags = [...new Set(members.flatMap((m) => m.candidate.tags ?? []))].sort();

  const hostnameSet = new Set<string>([new URL(canonicalUrl).hostname]);
  for (const member of members) {
    hostnameSet.add(member.ownHostname);
  }

  const alternateUrlSet = new Set<string>();
  for (const member of members) {
    if (member.ownNormalizedUrl !== canonicalUrl) {
      alternateUrlSet.add(member.ownNormalizedUrl);
    }
  }

  const officialStatus: OfficialStatus = members.some((m) =>
    VERIFYING_SOURCE_TYPES.has(m.sourceType),
  )
    ? "verified"
    : "unverified";

  const sourceRefs = [...new Set(members.map((m) => m.candidate.sourceId))];

  const discoveryMap = new Map<string, Portal["discovery"][number]>();
  for (const member of members) {
    const key = `${member.candidate.discoveredFromUrl}|${member.candidate.discoveryMethod}`;
    if (!discoveryMap.has(key)) {
      discoveryMap.set(key, {
        discoveredAt: nowIso,
        discoveredFromUrl: member.candidate.discoveredFromUrl,
        discoveryMethod: member.candidate.discoveryMethod,
      });
    }
  }

  const portal: Portal = {
    id: derivePortalId(canonicalUrl),
    schemaVersion: SCHEMA_VERSIONS.portal,
    name,
    canonicalUrl,
    alternateUrls: [...alternateUrlSet],
    hostnames: [...hostnameSet],
    geography: "assam",
    portalType,
    officialStatus,
    sourceRefs,
    discovery: [...discoveryMap.values()],
    tags,
  };
  if (department !== undefined) {
    portal.department = department;
  }
  return portal;
}
