import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PublishedPortalAssessment } from "@panchnama/schema";

/**
 * Portal-existence validation source (implementation.md section 5.14: "A
 * submission must reference an existing published portal ID; users cannot
 * introduce arbitrary URLs").
 *
 * Design decision: this loader reads the REAL `data/published/current` →
 * `data/published/<runId>/portal-assessments.json` output Session 8's
 * `audit-cli publish` command writes (see
 * `packages/audit-cli/src/review/publish-write.ts`), not a hard-coded or
 * database-backed portal list. This is the more correct design per
 * section 5.14's own framing — published audit data is the single source
 * of truth for "which portals exist" — and it is allowed by section 4.1's
 * stack choice: static generation is specified for the AUDIT scorecard
 * PAGES specifically, not for this server-side API route, which section
 * 4.1 explicitly permits to do filesystem/DB work ("a small server-side
 * API for experience submissions"). Reading `data/` here is READ-ONLY —
 * nothing in this module (or anywhere else in this session's routes) ever
 * opens a write handle to any path under `data/`.
 *
 * This module reads only `@panchnama/schema`'s `PublishedPortalAssessment`
 * type for typing the JSON shape it parses — it never imports from
 * `packages/audit-cli`/`packages/audit-core`, matching this session's
 * "no coupling to audit-cli internals" constraint.
 *
 * Empty-state handling: as of this session, `data/published/` is empty
 * (only a `.gitkeep` placeholder — Sessions 0-8 produced only fixture/test
 * output, cleaned up before commit; see docs/session-log.md Session 8/9).
 * `loadPublishedPortalIds()` treats "no `current` pointer file" and "no
 * resolved run directory" identically as `{ available: false, ids: new
 * Set() }` — a well-formed, non-throwing "no published inventory yet"
 * result, not a crash. `POST /api/experiences` uses `available` to return
 * a distinct, honest "no published inventory available yet" response
 * (rather than a generic "unknown portal id" for every single submission,
 * which would misleadingly imply the portal id itself was the problem).
 *
 * Test override: `setKnownPortalIdsOverrideForTests` lets tests inject a
 * fixture portal-id set without depending on real `data/published/`
 * content existing on disk, and without monkeypatching `fs`. Always call
 * it with `undefined` in test teardown to restore real-filesystem
 * behavior for later tests/files.
 */
export interface PublishedPortalIdsResult {
  available: boolean;
  ids: ReadonlySet<string>;
}

let testOverride: ReadonlySet<string> | undefined;

export function setKnownPortalIdsOverrideForTests(ids: readonly string[] | undefined): void {
  testOverride = ids ? new Set(ids) : undefined;
}

/** Repo-root `data/` directory, resolved relative to `process.cwd()`.
 * Next.js (`next dev`/`next build`/`next start`) and this package's own
 * `vitest run` both execute with cwd set to `apps/web/` (the workspace
 * package directory pnpm invokes the script from), so `../../data` from
 * there resolves to the repo-root `data/` directory. Overridable via
 * `PANCHNAMA_DATA_DIR` for any environment where that assumption does not
 * hold. */
function resolveDataDir(): string {
  return process.env.PANCHNAMA_DATA_DIR ?? join(process.cwd(), "..", "..", "data");
}

export function loadPublishedPortalIds(
  dataDir: string = resolveDataDir(),
): PublishedPortalIdsResult {
  if (testOverride) {
    return { available: true, ids: testOverride };
  }

  const publishedDir = join(dataDir, "published");
  const currentPath = join(publishedDir, "current");
  if (!existsSync(currentPath)) {
    return { available: false, ids: new Set() };
  }

  const runId = readFileSync(currentPath, "utf8").trim();
  if (!runId) {
    return { available: false, ids: new Set() };
  }

  const assessmentsPath = join(publishedDir, runId, "portal-assessments.json");
  if (!existsSync(assessmentsPath)) {
    return { available: false, ids: new Set() };
  }

  try {
    const assessments = JSON.parse(
      readFileSync(assessmentsPath, "utf8"),
    ) as PublishedPortalAssessment[];
    const ids = new Set(assessments.map((assessment) => assessment.portal.id));
    return { available: true, ids };
  } catch {
    // Malformed/unreadable published output — treat exactly like "not
    // available" rather than throwing and crashing the route.
    return { available: false, ids: new Set() };
  }
}

export async function isKnownPortalId(portalId: string, dataDir?: string): Promise<boolean> {
  return loadPublishedPortalIds(dataDir).ids.has(portalId);
}
