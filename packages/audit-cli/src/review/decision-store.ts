import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reviewDecisionSchema, type ReviewDecision } from "@panchnama/schema";

export interface LoadedDecision {
  file: string;
  findingId: string;
  decision?: ReviewDecision;
  parseError?: string;
}

/** Reads and schema-validates every `data/review/decisions/*.json` file.
 * Never throws — a malformed file is reported as a `parseError` entry so
 * callers can surface it as a validation issue instead of crashing. */
export function loadAllDecisions(decisionsDir: string): LoadedDecision[] {
  if (!existsSync(decisionsDir)) {
    return [];
  }
  const files = readdirSync(decisionsDir).filter((f) => f.endsWith(".json"));
  const out: LoadedDecision[] = [];
  for (const file of files) {
    const fullPath = join(decisionsDir, file);
    const findingIdFromName = file.slice(0, -".json".length);
    try {
      const raw = JSON.parse(readFileSync(fullPath, "utf8"));
      const parsed = reviewDecisionSchema.safeParse(raw);
      if (!parsed.success) {
        out.push({
          file: fullPath,
          findingId: findingIdFromName,
          parseError: parsed.error.message,
        });
        continue;
      }
      if (parsed.data.findingId !== findingIdFromName) {
        out.push({
          file: fullPath,
          findingId: findingIdFromName,
          parseError: `file name "${file}" does not match findingId "${parsed.data.findingId}" inside it`,
        });
        continue;
      }
      out.push({ file: fullPath, findingId: parsed.data.findingId, decision: parsed.data });
    } catch (error) {
      out.push({
        file: fullPath,
        findingId: findingIdFromName,
        parseError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return out;
}

/** Writes (or scaffolds) one `ReviewDecision` file. Refuses to overwrite an
 * existing hand-authored decision unless `overwrite` is explicitly true —
 * this is the same "never silently overwrite editorial work" principle
 * applied at the single-file level. */
export function writeDecisionFile(
  decisionsDir: string,
  decision: ReviewDecision,
  overwrite = false,
): { path: string } {
  mkdirSync(decisionsDir, { recursive: true });
  const path = join(decisionsDir, `${decision.findingId}.json`);
  if (existsSync(path) && !overwrite) {
    throw new Error(
      `refusing to overwrite existing review decision at "${path}" — pass an explicit override to replace hand-authored editorial work.`,
    );
  }
  writeFileSync(path, `${JSON.stringify(decision, null, 2)}\n`, "utf8");
  return { path };
}
