import { test, expect } from "@playwright/test";

/**
 * Automates implementation.md §13.3's 5 usability-validation tasks against
 * this repo's real fixture data (data/fixtures/portal-assessments.json).
 * This does not replace Session 20's human usability testing — it proves
 * the information these tasks require is actually present and reachable
 * in the rendered product, which is a precondition for a human being able
 * to complete them at all.
 */

test.describe("§13.3 task flow 1: identify the three portals needing attention first", () => {
  test("priority findings section lists the top 3 portals in severity/recency order", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Priority findings" }) });
    await expect(section).toBeVisible();
    const text = await section.innerText();
    const transportIndex = text.indexOf("Assam Transport Department Portal");
    const farmersIndex = text.indexOf("Assam Farmers Welfare Portal");
    const agriIndex = text.indexOf("Assam Agriculture Department Portal");
    expect(transportIndex).toBeGreaterThan(-1);
    expect(farmersIndex).toBeGreaterThan(-1);
    expect(agriIndex).toBeGreaterThan(-1);
    expect(transportIndex).toBeLessThan(farmersIndex);
    expect(farmersIndex).toBeLessThan(agriIndex);
  });
});

test.describe("§13.3 task flow 2: explain why one portal was flagged", () => {
  test("portal detail page shows the finding title and summary explaining the flag", async ({
    page,
  }) => {
    await page.goto("/portals/portal-transport-assam");
    await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
    await expect(page.getByText("Portal entry point unreachable")).toBeVisible();
    await expect(
      page.getByText("Connection refused on all three spaced attempts on 2026-09-15; not a bot block."),
    ).toBeVisible();
  });
});

test.describe("§13.3 task flow 3: distinguish a confirmed failure from a possible overlap", () => {
  test("a confirmed-unavailable portal and a possible-overlap portal render distinct status", async ({
    page,
  }) => {
    await page.goto("/portals/portal-transport-assam");
    await expect(page.getByText("Unavailable", { exact: true }).first()).toBeVisible();

    await page.goto("/portals/portal-agri-assam");
    await expect(page.getByText("Healthy", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Possible functional overlap with Farmers Welfare Portal")).toBeVisible();
  });
});

test.describe("§13.3 task flow 4: find where the portal was identified as official", () => {
  test("portal detail page shows official status and its source record", async ({ page }) => {
    await page.goto("/portals/portal-agri-assam");
    await expect(page.getByText("Official status:")).toBeVisible();
    await expect(page.getByText("verified", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Source: inventory record src-assam-directory-2026")).toBeVisible();
  });
});

test.describe("§13.3 task flow 5: state the recommended next action and its limitation", () => {
  test("portal detail page shows the suggested action and the finding's limitation", async ({
    page,
  }) => {
    await page.goto("/portals/portal-transport-assam");
    await expect(page.getByText("Repair", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Single-region vantage point.")).toBeVisible();
  });
});
