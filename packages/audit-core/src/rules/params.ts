/**
 * Small helper for reading typed parameters out of a rule's
 * `config/checks.yaml` `parameters` record (a `Record<string, unknown>` —
 * `packages/audit-cli/src/config/checks.ts` only validates that it's a
 * well-formed object, per that file's own doc comment; each rule is
 * responsible for validating the specific parameters it expects). Falls
 * back to a documented default if the parameter is absent or not a
 * positive integer, rather than throwing — a rule should degrade to a
 * sane default, not crash the whole `analyze` run, if a config file omits
 * a tunable.
 */
export function readIntParam(
  parameters: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = parameters[key];
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  return fallback;
}
