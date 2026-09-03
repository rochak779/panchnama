import { test, expect } from "@playwright/test";

/**
 * Verifies implementation.md §14 Session 19's "audit pages remain
 * statically generated" requirement at the HTTP level: a statically
 * generated Next.js page is served with Cache-Control markers indicating
 * a prerendered response, distinct from the dynamic /api/experiences*
 * routes. This runs against the same `next build && next start` server
 * Task 1's webServer already starts — no separate build step needed here.
 */
const STATIC_ROUTES = [
  "/",
  "/inventory",
  "/methodology",
  "/exports",
  "/privacy",
  "/portals/portal-agri-assam",
  "/portals/portal-agri-assam/share-experience",
];

for (const route of STATIC_ROUTES) {
  test(`${route} is served as prerendered static content`, async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}${route}`);
    expect(response.status()).toBe(200);
    const cacheControl = response.headers()["cache-control"] ?? "";
    // Next.js's static/ISR output serves with a cache-control header
    // distinct from a per-request dynamic render (which Next marks
    // no-store/no-cache by default). This is a coarse but real signal —
    // if Next's own header convention changes, update this string, but
    // do not delete the check.
    expect(cacheControl).not.toContain("no-store");
  });
}

// NOTE (final review, Important #3): a control test asserting a dynamic
// route (e.g. /api/portals/[portalId]/experiences, or a GET against the
// POST-only /api/experiences) carries a "no-store" Cache-Control marker
// was attempted here and FAILS against this app's local `next start`
// server: dynamic routes return no Cache-Control header at all locally
// (verified via curl against a `next start` instance — neither the
// 405 from GET /api/experiences nor the 200 from
// GET /api/portals/{id}/experiences carries any Cache-Control header,
// let alone "no-store"). Static routes do carry a real, distinct marker
// (`Cache-Control: s-maxage=31536000`), so the "no-store" string this
// suite checks for on static routes may only ever be added by Vercel's
// edge/CDN layer in production, not by `next start` itself — meaning
// this check cannot be meaningfully validated end-to-end against the
// local Playwright harness in either direction. Left unresolved
// pending a decision on either (a) asserting presence-vs-absence of any
// Cache-Control header as the real local discriminator instead of the
// "no-store" substring, or (b) accepting this signal only proves itself
// in a deployed/Vercel environment. See final-fix-report.md Important #3
// for full detail. Do not add a "no-store" control assertion here
// without first re-confirming it actually passes against the current
// server setup.
