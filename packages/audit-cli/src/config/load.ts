import { readFileSync } from "node:fs";
import { parse as parseYaml, YAMLParseError } from "yaml";
import type { z } from "zod";

/** One validation problem, always attributable to a file + a field path,
 * per this session's brief ("clear pass/fail with useful error messages
 * (file, path, reason)"). */
export interface ConfigIssue {
  file: string;
  path: string;
  reason: string;
}

export type LoadResult<T> = { ok: true; value: T } | { ok: false; issues: ConfigIssue[] };

/**
 * Reads a YAML file from disk, parses it, and validates it against a Zod
 * schema. No network activity. Never throws for a malformed/missing file or
 * a schema violation — those become `{ ok: false, issues }` so callers
 * (the `sources:validate` command) can report and fail closed rather than
 * crash.
 */
export function loadYamlConfig<T>(
  filePath: string,
  // The schema's Input type legitimately differs from its Output type T
  // (e.g. fields with `.default()`); only Output is relevant to callers,
  // so Input is intentionally left unconstrained here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodType<T, z.ZodTypeDef, any>,
): LoadResult<T> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    return {
      ok: false,
      issues: [{ file: filePath, path: "(file)", reason: describeFileError(error) }],
    };
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (error) {
    return {
      ok: false,
      issues: [{ file: filePath, path: "(yaml)", reason: describeYamlError(error) }],
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        file: filePath,
        path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
        reason: issue.message,
      })),
    };
  }

  return { ok: true, value: result.data };
}

function describeFileError(error: unknown): string {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return "file does not exist";
  }
  return error instanceof Error ? error.message : String(error);
}

function describeYamlError(error: unknown): string {
  if (error instanceof YAMLParseError) {
    return `invalid YAML: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
