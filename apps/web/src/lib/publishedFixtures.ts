import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  auditRunSchema,
  publishedPortalAssessmentSchema,
  type AuditRun,
  type PublishedPortalAssessment,
} from "@panchnama/schema";

/**
 * Session 11: "Load validated local published fixtures at build time"
 * (implementation.md section 14). Reads `data/fixtures/audit-run.json` and
 * `data/fixtures/portal-assessments.json` — hand-authored, schema-valid,
 * clearly-fictional fixture data (`data/fixtures/` is documented since
 * Session 0 as human-curated/committed, unlike `data/raw/`/`data/published`)
 * — and validates every record through `@panchnama/schema` before any page
 * reads it.
 *
 * This is deliberately distinct from `src/lib/publishedPortals.ts`
 * (Session 10): that module does a narrow, request-time, read-only
 * existence check against the *real* `data/published/current` output for
 * the experience-submission API, and returns a soft "not available" result
 * on any problem. This module is Session 11+'s page-content data source —
 * it reads at Next.js's build time (these functions are called from Server
 * Components / generateStaticParams, never from a client bundle) and
 * throws loudly on invalid or missing fixture data, because a broken
 * fixture should fail the build, not silently render an empty or wrong
 * page (implementation.md section 1.6 principle 1, "evidence before
 * judgment" extends to the build itself being honest about bad input).
 *
 * Sessions 12+ replace these calls with the equivalent read from real
 * `data/published/<runId>/...` output once it exists (Session 17+); the
 * validated-parse contract stays identical, so that swap should not need
 * to change any component's props.
 */

export class InvalidFixtureDataError extends Error {
  constructor(file: string, cause: unknown) {
    super(
      `${file} failed schema validation. Fixture data must be valid before any page can build ` +
        `from it — see apps/web/src/lib/publishedFixtures.ts.`,
    );
    this.name = "InvalidFixtureDataError";
    this.cause = cause;
  }
}

function resolveFixturesDir(): string {
  return process.env.PANCHNAMA_FIXTURES_DIR ?? join(process.cwd(), "..", "..", "data", "fixtures");
}

export function getFixtureAuditRun(fixturesDir: string = resolveFixturesDir()): AuditRun {
  const path = join(fixturesDir, "audit-run.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const result = auditRunSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidFixtureDataError(path, result.error);
  }
  return result.data;
}

export function getFixturePortalAssessments(
  fixturesDir: string = resolveFixturesDir(),
): PublishedPortalAssessment[] {
  const path = join(fixturesDir, "portal-assessments.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) {
    throw new InvalidFixtureDataError(path, new Error("expected a JSON array"));
  }
  return raw.map((entry, index) => {
    const result = publishedPortalAssessmentSchema.safeParse(entry);
    if (!result.success) {
      throw new InvalidFixtureDataError(`${path} [index ${index}]`, result.error);
    }
    return result.data;
  });
}
