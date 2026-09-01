import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Session 16, Task 3 — the "dead internal-link scan" the session's test
 * list requires. A filesystem-existence check, not an HTTP test: it fails
 * loudly if any nav/footer/banner link's target `page.tsx` is ever
 * deleted or renamed.
 *
 * Deliberately reads these four files' source text with a regex rather
 * than importing `NAV_ITEMS`/`FOOTER_LINKS` at runtime — this session's
 * global constraints forbid modifying `SiteHeader.tsx`/`SiteFooter.tsx`,
 * and those arrays are not currently exported, so importing them would
 * require a change to files this task is not allowed to touch. Also
 * deliberately not a full-app crawler (out of scope for this session, per
 * the task brief) — just these four fixed, explicit link sources.
 */

const APP_DIR = join(process.cwd(), "src", "app");
const COMPONENTS_DIR = join(process.cwd(), "src", "components");

const LINK_SOURCE_FILES = [
  "SiteHeader.tsx",
  "SiteFooter.tsx",
  "AuditContextBanner.tsx",
  "IndependenceNotice.tsx",
] as const;

/** Matches both `href: "/x"` (NAV_ITEMS/FOOTER_LINKS object literals) and `href="/x"` (JSX attributes). */
const HREF_PATTERN = /href(?::|=)\s*"(\/[^"]*)"/g;

function extractInternalHrefs(fileContents: string): string[] {
  const hrefs: string[] = [];
  for (const match of fileContents.matchAll(HREF_PATTERN)) {
    hrefs.push(match[1] ?? "");
  }
  return hrefs.filter((href) => href !== "");
}

/** Maps a route href to the `page.tsx` file that must exist for it to resolve. */
function routePagePath(href: string): string {
  const segments = href.split("/").filter(Boolean);
  return join(APP_DIR, ...segments, "page.tsx");
}

describe("internal link integrity (SiteHeader, SiteFooter, AuditContextBanner, IndependenceNotice)", () => {
  const linksByFile = new Map<string, string[]>();

  for (const filename of LINK_SOURCE_FILES) {
    const contents = readFileSync(join(COMPONENTS_DIR, filename), "utf8");
    linksByFile.set(filename, extractInternalHrefs(contents));
  }

  it("finds at least one internal link in the header, footer, and banner sources", () => {
    expect(linksByFile.get("SiteHeader.tsx")!.length).toBeGreaterThan(0);
    expect(linksByFile.get("SiteFooter.tsx")!.length).toBeGreaterThan(0);
    expect(linksByFile.get("AuditContextBanner.tsx")!.length).toBeGreaterThan(0);
  });

  it("resolves every internal link target to a real page.tsx under src/app", () => {
    for (const [filename, hrefs] of linksByFile) {
      for (const href of hrefs) {
        const pagePath = routePagePath(href);
        expect(existsSync(pagePath), `${filename}: "${href}" should resolve to ${pagePath}`).toBe(
          true,
        );
      }
    }
  });

  it("covers the known nav/footer/banner destinations (methodology, exports, privacy, inventory, home)", () => {
    const allHrefs = new Set([...linksByFile.values()].flat());
    for (const expected of ["/", "/inventory", "/methodology", "/exports", "/privacy"]) {
      expect(allHrefs.has(expected)).toBe(true);
    }
  });
});
