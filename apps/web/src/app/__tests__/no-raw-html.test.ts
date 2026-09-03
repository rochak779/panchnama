import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * implementation.md §14 Session 19: "verify raw HTML cannot enter
 * rendered pages." As of this test's writing, zero files under
 * apps/web/src use dangerouslySetInnerHTML — this is a regression guard
 * so a future change can't silently reintroduce raw-HTML rendering
 * (a real XSS-shaped risk for a page that will eventually show
 * user-submitted experience-report text) without a deliberate,
 * reviewed decision to update this test alongside it.
 */
function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      // Test files are excluded from the scan: this guard is about
      // rendered application source, and this test file's own source
      // necessarily contains the literal string "dangerouslySetInnerHTML"
      // (in the .includes() call above), which would otherwise always
      // self-match and fail the test.
      files.push(fullPath);
    }
  }
  return files;
}

describe("no raw HTML rendering", () => {
  it("no file under apps/web/src uses dangerouslySetInnerHTML", () => {
    const srcDir = join(process.cwd(), "src");
    const files = listFilesRecursive(srcDir);
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"));
    expect(offenders).toEqual([]);
  });
});
