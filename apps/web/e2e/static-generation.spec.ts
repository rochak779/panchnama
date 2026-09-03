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
