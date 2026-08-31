/**
 * Deterministic fixture portal ids, deliberately kept identical to
 * `validPortalA.id`/`validPortalB.id` in
 * `packages/schema/src/fixtures/valid.ts` (Session 1) — copied here as
 * literal strings rather than imported, because `@panchnama/schema`'s
 * package.json only exports its compiled `.` entry point (no `./fixtures`
 * subpath), and this session must not modify that package. If
 * `packages/schema` ever exposes a fixtures subpath export, this file
 * should switch to importing from it instead of duplicating the literals.
 *
 * Using the same ids keeps cross-package fixtures consistent, and means
 * `db:seed`'s seeded submissions reference portal ids another package's
 * tests already know about.
 *
 * This is dev/test convenience only, not the real portal registry —
 * `createPendingSubmission` accepts any `isKnownPortalId` check the caller
 * supplies (see src/repository/submissions.ts); Session 10's API layer is
 * expected to supply one backed by the real `data/published/<runId>/portals`
 * set once real Assam portals exist.
 */
export const FIXTURE_PORTAL_IDS = ["portal-agri-assam", "portal-agri-farmers-welfare"] as const;

export function isFixturePortalId(portalId: string): boolean {
  return (FIXTURE_PORTAL_IDS as readonly string[]).includes(portalId);
}
