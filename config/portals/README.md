# config/portals/

Per-portal crawl/render overrides (implementation.md section 4.3), referenced
by a `Portal` record's `crawlProfile` field (`@panchnama/schema`).

One YAML file per portal that needs to deviate from `config/crawl-policy.yaml`'s
defaults. Only include the settings that change — everything else falls back
to the crawl-policy default.

```yaml
schemaVersion: "1.0.0"
portalId: some-portal-id
overrides:
  maxPagesPerPortal: 20 # optional
  maxDepth: 1 # optional
  browserFallbackEnabled: true # optional
  additionalExcludedPathPatterns: ["/legacy/*"] # optional
  disabled: false # optional
```

Validate every file here with `pnpm run audit sources:validate`.

**Status (Session 2):** no `Portal` records exist yet (that's Session 3), so
no override files exist here yet either. `sources:validate` validates the
_shape_ of any file placed here, but cannot check that `portalId` refers to
a real portal until Session 3's inventory exists — see
docs/session-log.md, "Known limitations".

**Status (Session 6):** `overrides.browserFallbackEnabled` is now actually
read and enforced by `pnpm audit crawl` (`packages/audit-cli/src/crawl/run.ts`
loads every file here and feeds each portal's resolved value into the
browser-fallback eligibility gate — see `packages/audit-core/src/
browser-eligibility.ts` for the documented override + allowlist
interaction). `maxPagesPerPortal`, `maxDepth`, and `disabled` remain
unread/unenforced, a documented limitation carried forward.
