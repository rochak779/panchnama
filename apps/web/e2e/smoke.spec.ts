import { test, expect } from "@playwright/test";

test("homepage loads and shows the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Panchnama/i);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});
