# config/

Authoritative, version-controlled configuration for the audit pipeline
(implementation.md sections 4.3 and 6):

- `sources.assam.yaml` — authoritative inventory sources
- `crawl-policy.yaml` — crawl limits, exclusions, and rate controls
- `checks.yaml` — enabled checks and thresholds
- `portals/` — per-portal crawl/render overrides

**Status:** populated in Session 2 ("Configuration and source registry").
`sources.assam.yaml`'s entries are placeholder/illustrative content pending
re-verification in Session 17 — see the warning comment at the top of that
file. No network activity happens as part of validating this configuration.

Validate everything in this directory with:

```bash
pnpm run audit sources:validate
```

See `docs/adding-sources.md` for how to add a new source without editing
any code.
