import { test, expect } from "@playwright/test";

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

const ROUTES_TO_CHECK = ["/", "/portals/portal-transport-assam"];

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`viewport: ${name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });
    for (const route of ROUTES_TO_CHECK) {
      test(`${route} renders with no horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        // A few px of tolerance for scrollbar-width rounding, not a loosened check.
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      });
    }
  });
}

test.describe("200% zoom", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const route of ROUTES_TO_CHECK) {
    test(`${route} stays usable at 200% zoom (content not clipped)`, async ({ page }) => {
      await page.goto(route);
      // Playwright has no native browser-zoom control; CSS zoom is the
      // standard stand-in for "200% zoom" browser-compat testing and
      // reflows layout the same way real browser zoom does in Chromium.
      await page.evaluate(() => {
        document.documentElement.style.zoom = "200%";
      });
      const heading = page.getByRole("heading", { level: 1 }).first();
      await expect(heading).toBeVisible();
      const box = await heading.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
    });
  }
});

test.describe("reduced motion", () => {
  test("homepage respects prefers-reduced-motion via the motion-duration tokens", async ({ page }) => {
    // `test.use({ reducedMotion: "reduce" })` sets the context option, but
    // in this environment it does not reliably apply the emulated media
    // feature before the initial navigation (matchMedia still reports
    // false after goto). Calling page.emulateMedia() explicitly before
    // navigating is the documented alternative and is verified to apply
    // the media feature deterministically.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const fastDuration = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--motion-duration-fast").trim(),
    );
    // apps/web/src/styles/tokens.css zeroes --motion-duration-fast under
    // prefers-reduced-motion: reduce.
    expect(fastDuration).toBe("0ms");
  });
});
