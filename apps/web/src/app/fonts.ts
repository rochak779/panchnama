import { IBM_Plex_Mono, Public_Sans } from "next/font/google";

/**
 * One UI family for the whole product (Operate/Read-mode guidance: product
 * UI rarely needs a display/body pairing) — Public Sans, USWDS's own
 * typeface: a workhorse civic/data-register face, not a training-data
 * display-face default, and a fitting association for an evidence-register
 * audit tool without borrowing any Government of Assam or national mark.
 * IBM Plex Mono is reserved for actual data — timestamps, hashes, run ids —
 * never as a decorative "technical" costume (see tokens.css).
 *
 * `next/font` self-hosts the font files at build time (no runtime request
 * to Google Fonts, no layout-shift-prone external `<link>`), exposed as
 * CSS custom properties consumed by `tokens.css`'s `--font-sans`/
 * `--font-mono`.
 */
export const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-data",
  display: "swap",
});
