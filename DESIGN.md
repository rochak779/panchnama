---
name: Panchnama
description: An evidence-register audit scorecard — sober, legible, calm, independent of any government mark.
colors:
  canvas: "#f5f6f8"
  surface: "#ffffff"
  surface-secondary: "#eceef1"
  border: "#d5d9de"
  border-strong: "#aab1ba"
  ink: "#14181d"
  ink-secondary: "#444b54"
  ink-muted: "#667079"
  accent: "#464b78"
  accent-strong: "#363a5e"
  accent-surface: "#eceefc"
  status-good: "#1b6b40"
  status-good-surface: "#e6f2ea"
  status-caution: "#7a5900"
  status-caution-surface: "#f7eed9"
  status-severe: "#a3271f"
  status-severe-surface: "#f8e6e4"
  status-info: "#2f5773"
  status-info-surface: "#e6edf2"
  status-unknown: "#565f68"
  status-unknown-surface: "#eceef0"
typography:
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontWeight: 600
    lineHeight: 1.25
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  sm: "4px"
  md: "6px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  8: "48px"
  10: "64px"
components:
  status-badge:
    backgroundColor: "{colors.status-good-surface}"
    textColor: "{colors.status-good}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  evidence-callout:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "16px"
---

## Overview

Panchnama is an independent, evidence-backed audit of the observed Assam
government web estate (see `PRODUCT.md`). Its interface must read as **an
evidence register: sober, legible, calm, and specific** — a case-file
registry, not a government portal and not a product-marketing surface
(implementation.md section 10.10, the brief that pins this world; this
direction was not resolved by a concept tournament — see the finish-review
note in this session's status report).

The product is Operate/Read mode throughout: users are here to find out
which portals need attention and why, not to be persuaded or delighted.
Familiarity and restraint are features. One rule overrides every other
craft decision on this project: **status is never communicated by color
alone** (icon + text label + color, always, together).

## Colors

Strategy: **Restrained** — a cool neutral scale plus exactly one accent.

- `canvas` (`#f5f6f8`) / `surface` (`#ffffff`) / `surface-secondary`
  (`#eceef1`): page background, cards, and the audit-context banner/sidebar
  wash, in that order of "how far from the page edge."
- `border` / `border-strong`: hairline dividers and card outlines. Never
  goes above 1px, and never as a colored `border-left` accent stripe
  (craft-floor ban).
- `ink` / `ink-secondary` / `ink-muted`: body text, secondary text
  (department names, meta), and the most muted tier (footer meta, empty
  states). All three clear 4.5:1 against both `canvas` and `surface` —
  enforced by `apps/web/src/styles/tokens.contrast.test.ts`, not just
  eyeballed.
- `accent` (`#464b78`, a muted slate-indigo) / `accent-strong` /
  `accent-surface`: the **one** accent. Reserved for links, primary
  actions, current selection, and the focus ring. Deliberately not blue —
  avoids visual association with common Indian government portal palettes
  — and never reused for status.
- Five semantic status tones (`good`/`caution`/`severe`/`info`/`unknown`),
  each with a text color and a light surface tint, mapped from the domain
  enums in `apps/web/src/components/status/statusTokens.ts`
  (`TechnicalHealth`, `Severity`, `SuggestedAction`). Every one of these is
  always paired with a distinct icon shape and a text label in the
  component that renders it — the color is a reinforcing third channel,
  never the only one.

Dark mode: not built. This is a document/registry surface read in normal
office/desktop light; no user need was established for a dark theme
(PRODUCT.md's Accessibility & Inclusion section does not call for one).

## Typography

One family for the whole product (Operate/Read guidance: product UI rarely
needs a display/body split): **Public Sans** — USWDS's own civic/data-
register typeface, self-hosted via `next/font/google`
(`apps/web/src/app/fonts.ts`). Chosen for its evidence-register character
without borrowing government branding, and specifically to avoid the
training-data display-face defaults the craft floor warns against.

**IBM Plex Mono** is reserved for actual data — timestamps, audit-run ids,
digests/hashes, URLs — never as a decorative "technical" costume.

Fixed rem scale, not fluid (`--font-size-xs` 12px through `--font-size-2xl`
36px, `tokens.css`), tighter ratio (~1.15–1.2 between steps) than a
marketing site would use. Body copy is capped at a comfortable measure
(`.hero p`/prose blocks target 65ch, per `page.module.css`).

## Layout

- Content max-width `1180px` (`--breakpoint-content-max`), centered, with
  `1rem`–`2rem` side padding depending on breakpoint.
- Structural responsive behavior, not fluid typography: the header row
  wraps to two lines and the audit-context banner's link group drops its
  `margin-left: auto` push below `768px`; the portal grid is
  `auto-fill, minmax(280px, 1fr)`, collapsing to one column under ~320px
  container width. Verified: no horizontal overflow at a real 320px
  viewport (`.impeccable/review/mobile.png`).
- 4px-based spacing scale (`--space-1` 4px through `--space-10` 64px).
  Cards/panels use `--space-4` internal padding; sections stack with
  `--space-6`.

## Elevation & Depth

None. This is a flat, bordered world by design — an evidence register
reads as paper/index cards, not floating panels. No `box-shadow` appears
anywhere in `apps/web/src/components/` or `src/styles/`. If a future
session needs to lift an overlay (a dropdown, a modal) above content, add a
real offset+blur shadow token then; don't retrofit shadows onto the flat
surfaces this session built.

## Shapes

Small, boxy radii: `--radius-sm` (4px) for badges/pills, `--radius-md`
(6px) for cards/panels. Never fully rounded ("pill" beyond the status
badge's own small radius) and never sharp 0px — both would read as a
deliberate choice this world didn't make. Borders are always 1px
(`--border-width-hairline`); `--border-width-emphasis` (2px) exists only
for the focus ring and the (currently unused) nav active-state underline.

## Components

- **StatusBadge** (`components/status/StatusBadge.tsx`): filled pill,
  tone-colored background + border + text, icon + label always both
  present. Renders `TechnicalHealth`.
- **SeverityMarker** (`components/status/SeverityMarker.tsx`): inline
  (no filled background) icon + label, deliberately visually distinct from
  StatusBadge so a portal's overall health and one finding's severity are
  never confused. Each severity gets its own icon _shape_
  (octagon/triangle/circle), not just a color, so the distinction survives
  grayscale.
- **EvidenceCallout** (`components/EvidenceCallout.tsx`): bordered panel,
  a `FileTextIcon`, a real heading (never a small eyebrow above a larger
  one — the craft floor bans kickers outright), body content, and an
  optional citation `meta` line (rule id, timestamp, source).
- **EmptyState** / **ErrorState** (`components/EmptyState.tsx` /
  `ErrorState.tsx`): same visual shell (bordered block, icon, title,
  description, optional action), differing only in icon/tone and ARIA role
  (`status` vs `alert`) — a normal "nothing here yet" outcome must never
  look or sound like a failure.
- **SiteHeader / AuditContextBanner / SiteFooter**
  (`components/SiteHeader.tsx`, `AuditContextBanner.tsx`,
  `SiteFooter.tsx`): the persistent shell every page inherits. Header:
  plain-text wordmark (no emblem/seal) + an inline "not a government
  website" tag + primary nav. Banner: audit date/coverage/run-status +
  methodology/export links, always visible, never dismissible. Footer:
  repeats the independence disclaimer verbatim (`IndependenceNotice.tsx`,
  the single source of that copy) plus the same link set.
- **Icons** (`components/icons.tsx`): a small hand-authored SVG set, one
  consistent stroke (1.75, round caps/joins), 24×24 viewBox. No emoji, no
  icon-font glyphs.

All interactive elements share one focus treatment: a 2px accent-colored
outline, 2px offset, `:focus-visible` only (`globals.css`) — never
suppressed.

## Do's and Don'ts

**Do**

- Pair every status/severity value with both an icon (a real shape) and a
  text label — color reinforces, never carries the meaning alone.
- Keep the accent to actions, links, selection, and focus. Nothing else
  earns it.
- Use `IBM Plex Mono` only for genuine data (ids, timestamps, hashes,
  URLs).
- Add new status tones to `statusTokens.ts` (the single source of truth),
  never invent a one-off color for a single component.
- Route any new page's audit-date/coverage/methodology-link needs through
  `AuditContextBanner`, not a re-derived one-off summary.

**Don't**

- Don't add a shadow to a static card/panel — this world is flat by
  construction.
- Don't add a colored `border-left` accent stripe to a card or callout.
- Don't add a kicker/eyebrow label above a heading, for any component.
- Don't reach for the accent color (or introduce a second accent) to
  encode status — that's what the five semantic tones are for.
- Don't render an emblem, seal, tricolor motif, or any imagery that could
  read as official Government of Assam branding, anywhere in the product.
- Don't build a composite/blended score visual — technical health,
  severity, and suggested action always render as distinct, separately
  labeled fields (PRODUCT.md's Product Principles).
