# Manual keyboard review

implementation.md §14 Session 19 calls for "automated accessibility audit
and manual keyboard review." The automated half is
`apps/web/e2e/accessibility.spec.ts` (an `axe-core` scan of every route,
plus a scripted Tab-traversal check that focus never silently drops to
`<body>`).

The "manual" half cannot honestly be performed by an automated agent —
this document records what the scripted check above does and does not
substitute for, rather than silently claiming a manual review happened
when it didn't.

## What the scripted keyboard check covers

- Every focusable element on all 7 product routes receives visible DOM
  focus when tabbed to (focus never drops to `<body>`).
- Runs against real rendered pages (a full browser), not jsdom.

## What it cannot cover (needs an actual human, or Session 20's usability testing)

- Whether the **visual** focus indicator (outline/ring) is actually
  perceivable against its background at each focus stop — the script
  checks `document.activeElement`, not rendered contrast/visibility of
  the focus ring.
- Whether the **tab order** matches a sighted keyboard user's visual/
  reading expectation (the script only checks focus never gets lost, not
  that the order makes sense).
- Whether **Escape**/arrow-key patterns on any interactive widget (e.g.
  the share-experience form's fields) behave the way a keyboard-only user
  would expect.
- Screen-reader behavior (axe catches missing ARIA/labels statically, but
  not how a screen reader actually announces the page).

## Recommendation

Fold an actual manual keyboard pass into Session 20's usability testing
(implementation.md §13.3/§14 Session 20 already recruits real
participants) rather than treating this document as a substitute —
tracked here so the gap is visible, not silently assumed closed.
