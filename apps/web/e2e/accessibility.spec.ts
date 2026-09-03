import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = [
  "/",
  "/inventory",
  "/methodology",
  "/exports",
  "/privacy",
  "/portals/portal-agri-assam",
  "/portals/portal-agri-assam/share-experience",
];

for (const route of ROUTES) {
  test(`axe: ${route} has no automatically-detectable accessibility violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test.describe("best-effort automated keyboard traversal", () => {
  for (const route of ROUTES) {
    test(`keyboard: ${route} — Tab never loses focus to <body>`, async ({ page }) => {
      await page.goto(route);
      // Counted in-browser (not via a plain CSS .count()) so radio-button
      // groups collapse to the single tab stop a real Tab key actually
      // lands on (a <select>-like group, not one stop per <input>), and so
      // any tabindex="-1" element is excluded even when it also matches a
      // native-tabbable tag selector (e.g. the honeypot text input) —
      // otherwise this bound over-counts and the loop below "runs off the
      // end" into browser chrome, which reads as focus landing on <body>
      // even though nothing was ever actually trapped.
      const focusableCount = await page.evaluate(() => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]",
          ),
        );
        const seenRadioGroups = new Set<string>();
        let count = 0;
        for (const el of candidates) {
          if (el.getAttribute("tabindex") === "-1") continue;
          // offsetParent is null for display:none (and its subtree), so this
          // excludes elements that receive no real Tab stop. It does NOT
          // catch visibility:hidden — a known limitation of this heuristic.
          if (el.offsetParent === null) continue;
          if (el instanceof HTMLInputElement && el.type === "radio") {
            const key = el.name || "";
            if (seenRadioGroups.has(key)) continue;
            seenRadioGroups.add(key);
          }
          count++;
        }
        return count;
      });
      expect(focusableCount).toBeGreaterThan(0);

      // Tab through every focusable element (bounded by the page's own
      // count, so this never loops forever on an unexpected focus trap)
      // and assert focus is always on a real element, never silently
      // dropped back to <body> — a WCAG 2.1.1 keyboard-trap/loss symptom
      // jest-axe's jsdom-based component tests cannot detect (see
      // docs/session-log.md Session 16).
      for (let i = 0; i < focusableCount; i++) {
        await page.keyboard.press("Tab");
        const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
        expect(activeTag).not.toBe("BODY");
      }
    });
  }
});
