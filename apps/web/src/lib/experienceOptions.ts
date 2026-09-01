// Imported from the `./constants` subpath, not the package's default `.`
// entry point: the default entry (`@panchnama/database`'s `index.ts`)
// re-exports `client.ts`/`env.ts`, which pull in the Postgres driver and
// `node:fs`/`node:path` — fine for this file's own server-only consumer
// (`requestSchema.ts`, used only by the API route), but this file is also
// imported directly by Session 15 Task 2's client-side submission form
// (`ShareExperienceForm.tsx`, for `TASK_TYPE_OPTIONS`), and a browser
// bundle cannot include Node-only modules. `./constants` is a plain,
// side-effect-free values module, so importing it here keeps every
// consumer of this file client-bundle-safe.
import { EXPERIENCE_THEME_VALUES } from "@panchnama/database/constants";

/**
 * Controlled task/theme vocabulary for the experience submission form
 * (implementation.md section 9.6/5.12: "controlled vocabulary plus
 * other" for `taskType`).
 *
 * This session serves both `taskType` and `themes` options as a static,
 * importable constants module rather than building the optional
 * `GET /api/portals/:portalId/experience-options` route implementation.md
 * section 9.6 explicitly allows skipping ("...or serve these choices
 * statically"). A static module is simpler, needs no network round trip
 * for what is fixed configuration, and is trivially importable both by
 * this session's own Zod validation (`requestSchema.ts`) and by Session
 * 11+'s frontend form — the two places that actually need these values.
 * If a future session finds a real need for per-portal-varying options
 * (not true today — the vocabulary below is portal-agnostic), the route
 * can be added then without disturbing this module's shape.
 *
 * `themes` reuses `@panchnama/database`'s `EXPERIENCE_THEME_VALUES`
 * (itself mirrored from `packages/schema/src/enums.ts`'s
 * `experienceThemeSchema`) rather than redeclaring the list a third time.
 *
 * `taskType` has no prior-session controlled list — `packages/schema`
 * deliberately left it as `nonEmptyString` with a doc comment describing
 * the intent ("controlled vocabulary plus other") without picking values,
 * since no session before this one owned form UX. The list below is this
 * session's own reasonable pilot default for citizen-facing Assam
 * government portal tasks, not a value handed down from an earlier
 * session — a later session is free to extend it (adding a value here is
 * additive and never breaks existing stored submissions, since
 * `taskType` is a plain `text` column, not a CHECK-constrained enum).
 */
export const TASK_TYPE_OPTIONS = [
  "apply_for_scheme_or_benefit",
  "check_application_or_case_status",
  "download_or_view_document",
  "make_a_payment",
  "find_information",
  "register_a_complaint_or_grievance",
  "renew_license_or_certificate",
  "create_or_update_account",
  "other",
] as const;

export type TaskTypeOption = (typeof TASK_TYPE_OPTIONS)[number];

export function isKnownTaskType(value: string): value is TaskTypeOption {
  return (TASK_TYPE_OPTIONS as readonly string[]).includes(value);
}

export const THEME_OPTIONS = EXPERIENCE_THEME_VALUES;
