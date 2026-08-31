/** Finds `--<name> <value>` in argv. Mirrors the small flag-parsing helper
 * `packages/audit-cli/src/cli.ts` already uses, kept local to this package
 * rather than shared, since it's a few lines and the two CLIs are
 * otherwise unrelated. */
export function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}
