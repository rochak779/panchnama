# Adding a source to the inventory registry

This is for anyone adding a new official-website source to Panchnama's
Assam inventory — no coding experience required. You are editing one text
file and running one command.

## What a "source" is

A **source** is a place we look to find official Assam government
websites — for example, a state directory page that lists department
websites, or a single department's own homepage. Adding a source here does
**not** fetch anything yet; it only tells a later step ("inventory build",
a separate session's tool) where to look. No website is contacted when you
edit this file or run the validation command below.

## Where to add it

Open `config/sources.assam.yaml` in a text editor. Add a new entry under
`sources:`, following the pattern of the existing entries:

```yaml
sources:
  - id: my-new-source
    name: "Human-readable name of this website/directory"
    authorityName: "Which government body owns/runs it"
    url: "https://example.assam.gov.in"
    sourceType: official_page # or: official_directory, manual_verified
    enabled: true
    notes: "Anything worth knowing about this source."
```

Field reference:

| Field           | Required                | Meaning                                                                                                                                                                                       |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | yes                     | A short, unique, URL-safe identifier (letters, digits, `.`, `_`, `-`, `~` only — no spaces). Must not repeat any other source's `id`.                                                         |
| `name`          | yes                     | Plain-language name of the website or directory.                                                                                                                                              |
| `authorityName` | yes                     | The government body responsible for it.                                                                                                                                                       |
| `url`           | yes                     | Full `http://` or `https://` address. No other schemes are allowed.                                                                                                                           |
| `sourceType`    | yes                     | `official_directory` (a page that lists other portals), `official_page` (a single portal's own site), or `manual_verified` (identified by manual research rather than an official directory). |
| `enabled`       | no (defaults to `true`) | Set to `false` to keep an entry in the file (for history/traceability) without it being used.                                                                                                 |
| `notes`         | no                      | Free text — context, caveats, "needs re-verification", etc.                                                                                                                                   |

## Validate before committing

After editing, run:

```bash
pnpm run audit sources:validate
```

This checks, entirely offline (no network requests):

- the file is valid YAML and matches the expected shape;
- no two sources share the same `id`;
- every `url` is well-formed and uses `http`/`https`;
- `geography` is a currently-supported value (`assam` is the only one
  right now);
- `config/crawl-policy.yaml`, `config/checks.yaml`, and any files under
  `config/portals/` are also valid.

The command prints `sources:validate PASSED` with a summary, or
`sources:validate FAILED` with a list of `file / field / reason` for every
problem found, and exits with a non-zero status on failure — so a broken
file cannot silently proceed to a later step.

## What happens next (not this step)

Adding a source here only registers _intent to use it_. A later pipeline
step ("inventory build", a separate tool from a later development session)
is what actually fetches a source, records when it was retrieved
(`retrievedAt`) and where the evidence snapshot was saved (`evidencePath`),
and turns it into the permanent inventory record. Editing this file and
running `sources:validate` never contacts the internet.

## Before using a source for a real audit run

Every entry currently in `config/sources.assam.yaml` is placeholder content
pending independent re-verification (see the file's header comment). Before
any source — new or existing — is used to drive a real crawl, someone must
manually confirm the URL is correct, currently live, and genuinely official
to the named authority.
