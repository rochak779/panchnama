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
    // `s-maxage` (not "no-store") is the real signal for static
    // generation under local `next start`: "no-store" is only ever
    // added by Vercel's edge/CDN layer in production, so it never
    // appears locally on either static or dynamic routes.
    expect(cacheControl).toContain("s-maxage");
  });
}

test("GET /api/portals/portal-agri-assam/experiences (dynamic route) has no Cache-Control header", async ({
  request,
  baseURL,
}) => {
  const response = await request.get(`${baseURL}/api/portals/portal-agri-assam/experiences`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBeUndefined();
});
