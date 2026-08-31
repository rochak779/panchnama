import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { portalOverlapComparisonSchema, type PortalOverlapComparison } from "@panchnama/schema";

export interface LoadedOverlapComparison {
  file: string;
  comparisonId: string;
  comparison?: PortalOverlapComparison;
  parseError?: string;
}

/**
 * Reads and schema-validates every hand-authored `PortalOverlapComparison`
 * file under `data/review/overlap-comparisons/<comparisonId>.json` —
 * implementation.md section 7.6 / section 5.9's manual-review-first
 * workflow. This session provides no automated overlap detection; a human
 * reviewer authors one of these files directly (or via the `review:scaffold
 * --overlap` helper — see `commands/review-scaffold.ts`) following the
 * `portalOverlapComparisonSchema` shape.
 */
export function loadAllOverlapComparisons(
  overlapComparisonsDir: string,
): LoadedOverlapComparison[] {
  if (!existsSync(overlapComparisonsDir)) {
    return [];
  }
  const files = readdirSync(overlapComparisonsDir).filter((f) => f.endsWith(".json"));
  const out: LoadedOverlapComparison[] = [];
  for (const file of files) {
    const fullPath = join(overlapComparisonsDir, file);
    const idFromName = file.slice(0, -".json".length);
    try {
      const raw = JSON.parse(readFileSync(fullPath, "utf8"));
      const parsed = portalOverlapComparisonSchema.safeParse(raw);
      if (!parsed.success) {
        out.push({ file: fullPath, comparisonId: idFromName, parseError: parsed.error.message });
        continue;
      }
      if (parsed.data.id !== idFromName) {
        out.push({
          file: fullPath,
          comparisonId: idFromName,
          parseError: `file name "${file}" does not match id "${parsed.data.id}" inside it`,
        });
        continue;
      }
      out.push({ file: fullPath, comparisonId: parsed.data.id, comparison: parsed.data });
    } catch (error) {
      out.push({
        file: fullPath,
        comparisonId: idFromName,
        parseError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return out;
}

export function writeOverlapComparisonFile(
  overlapComparisonsDir: string,
  comparison: PortalOverlapComparison,
  overwrite = false,
): { path: string } {
  mkdirSync(overlapComparisonsDir, { recursive: true });
  const path = join(overlapComparisonsDir, `${comparison.id}.json`);
  if (existsSync(path) && !overwrite) {
    throw new Error(
      `refusing to overwrite existing overlap comparison at "${path}" — pass an explicit override.`,
    );
  }
  writeFileSync(path, `${JSON.stringify(comparison, null, 2)}\n`, "utf8");
  return { path };
}
