import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

/**
 * Mirrors the hex values in `tokens.css`. Kept as literal strings (not
 * parsed from the CSS file) so this test fails loudly and specifically —
 * "which token, which ratio" — whenever a future edit to tokens.css
 * changes one of these without re-checking contrast, rather than silently
 * drifting. AA body-text minimum is 4.5:1 (implementation.md section 10.9:
 * "Meet WCAG 2.2 AA where feasible").
 */
const CANVAS = "#f5f6f8";
const SURFACE = "#ffffff";
const AA_BODY_TEXT_MIN = 4.5;

const textColors: Record<string, string> = {
  "--color-ink": "#14181d",
  "--color-ink-secondary": "#444b54",
  "--color-ink-muted": "#667079",
  "--color-accent": "#464b78",
  "--color-accent-strong": "#363a5e",
  "--color-status-good": "#1b6b40",
  "--color-status-caution": "#7a5900",
  "--color-status-severe": "#a3271f",
  "--color-status-info": "#2f5773",
  "--color-status-unknown": "#565f68",
};

describe("design token contrast (WCAG 2.2 AA, 4.5:1 body text minimum)", () => {
  for (const [name, hex] of Object.entries(textColors)) {
    it(`${name} (${hex}) clears 4.5:1 against the page canvas`, () => {
      expect(contrastRatio(hex, CANVAS)).toBeGreaterThanOrEqual(AA_BODY_TEXT_MIN);
    });

    it(`${name} (${hex}) clears 4.5:1 against a white surface/card`, () => {
      expect(contrastRatio(hex, SURFACE)).toBeGreaterThanOrEqual(AA_BODY_TEXT_MIN);
    });
  }
});
