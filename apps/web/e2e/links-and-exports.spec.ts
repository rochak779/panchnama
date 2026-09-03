import { test, expect } from "@playwright/test";

test.describe("broad internal link crawl", () => {
  test("every same-origin link reachable from the homepage responds 200", async ({ page }) => {
    await page.goto("/");
    const visited = new Set<string>();
    const toVisit = new Set<string>(["/"]);

    while (toVisit.size > 0) {
      const path = toVisit.values().next().value as string;
      toVisit.delete(path);
      if (visited.has(path)) continue;
      visited.add(path);

      const response = await page.goto(path);
      expect(response, `navigating to ${path}`).not.toBeNull();
      expect(response!.status(), `${path} should respond 200`).toBe(200);

      const hrefs = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => a.getAttribute("href")).filter((h): h is string => h !== null),
      );
      for (const href of hrefs) {
        if (!href.startsWith("/") || href.startsWith("//")) continue; // same-origin, path-relative only
        const cleanPath = href.split("#")[0]!.split("?")[0]!;
        if (cleanPath.startsWith("/api/")) continue; // API routes aren't navigable pages
        // The /exports page's file links carry a `download` attribute, so
        // browsing directly to them triggers a file download rather than a
        // page navigation (Playwright surfaces that as "Download is
        // starting" from page.goto). They're covered by the export
        // integrity checks below instead.
        if (cleanPath.startsWith("/exports/")) continue;
        if (!visited.has(cleanPath)) toVisit.add(cleanPath);
      }
    }

    // Sanity: the crawl actually found more than just the homepage —
    // guards against this test silently passing on a broken/empty crawl.
    expect(visited.size).toBeGreaterThan(3);
  });
});

test.describe("export download integrity", () => {
  const EXPORT_FILES = [
    "audit-summary.json",
    "portals.json",
    "findings.json",
    "assam-audit.csv",
    "methodology.json",
  ];

  for (const filename of EXPORT_FILES) {
    test(`/exports/${filename} downloads real, non-empty content`, async ({ request, baseURL }) => {
      const response = await request.get(`${baseURL}/exports/${filename}`);
      expect(response.status()).toBe(200);
      const body = await response.body();
      expect(body.length).toBeGreaterThan(0);
    });
  }

  test("/exports page links to all 5 files and they are visible", async ({ page }) => {
    await page.goto("/exports");
    for (const filename of EXPORT_FILES) {
      await expect(page.getByText(filename, { exact: true })).toBeVisible();
    }
  });
});
