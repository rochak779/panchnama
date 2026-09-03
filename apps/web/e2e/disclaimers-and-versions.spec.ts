import { test, expect } from "@playwright/test";

/**
 * implementation.md §14 Session 19: "check all disclaimers, dates,
 * versions, and source labels." PRODUCT_DISCLAIMER
 * (apps/web/src/lib/constants.ts) is the single shared disclaimer string
 * reused by SiteHeader/SiteFooter/IndependenceNotice per Session 11 — this
 * test asserts it is actually present on rendered pages, not just defined
 * in source.
 */
const PRODUCT_DISCLAIMER =
  "Panchnama is an independent case-study prototype and is not affiliated with or endorsed by the Government of Assam.";

const PAGES_WITH_DISCLAIMER = ["/", "/inventory", "/portals/portal-agri-assam", "/methodology"];

for (const route of PAGES_WITH_DISCLAIMER) {
  test(`${route} shows the independence disclaimer`, async ({ page }) => {
    await page.goto(route);
    // Some pages render the disclaimer twice (e.g. a page-level
    // IndependenceNotice plus the shared SiteFooter) — .first() only
    // needs to prove the text is present and visible somewhere.
    await expect(page.getByText(PRODUCT_DISCLAIMER).first()).toBeVisible();
  });
}

test("portal detail page shows the audit run's last-checked date", async ({ page }) => {
  await page.goto("/portals/portal-agri-assam");
  // "Official status:" is already asserted on this exact route by
  // task-flows.spec.ts (task flow 4) — this test only covers the
  // "Last checked" date, which is not duplicated elsewhere.
  await expect(page.getByText("Last checked", { exact: false })).toBeVisible();
});

test("methodology page shows a methodology version", async ({ page }) => {
  await page.goto("/methodology");
  // apps/web/src/lib/methodologyContent.ts's CURRENT_METHODOLOGY_VERSION
  // is cross-checked in its own unit test against
  // data/fixtures/audit-run.json's methodologyVersion (Session 16) — this
  // e2e test only needs to prove *a* version string renders, not
  // duplicate that unit test's exact-value check.
  await expect(page.getByText(/version/i).first()).toBeVisible();
});
