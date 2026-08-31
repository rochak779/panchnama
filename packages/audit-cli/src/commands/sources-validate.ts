import { defaultConfigPaths, validateAllConfig } from "../config/index.js";

/**
 * `pnpm audit sources:validate` — implementation.md section 9.1/9.2.
 *
 * Loads and validates `config/sources.assam.yaml`, `config/crawl-policy.yaml`,
 * `config/checks.yaml`, and every `config/portals/*.yaml` override file.
 * Performs no network activity. Exits non-zero (via the returned exit code)
 * on any validation failure — this command fails closed: there is no code
 * path here that proceeds past a validation failure to anything else.
 */
export interface CommandOutput {
  exitCode: 0 | 1;
  lines: string[];
}

export function runSourcesValidate(configDir: string): CommandOutput {
  const paths = defaultConfigPaths(configDir);
  const result = validateAllConfig(paths);

  if (!result.ok) {
    const lines = [
      `sources:validate FAILED — ${result.issues.length} issue(s):`,
      ...result.issues.map((issue) => `  - ${issue.file} [${issue.path}]: ${issue.reason}`),
    ];
    return { exitCode: 1, lines };
  }

  const lines = [
    "sources:validate PASSED",
    `  sources: ${result.sourceCount ?? 0}`,
    `  portal overrides: ${result.portalOverrideCount ?? 0}`,
    `  sourceRegistryDigest: ${result.digests?.sourceRegistryDigest}`,
    `  crawlPolicyDigest: ${result.digests?.crawlPolicyDigest}`,
    `  checkConfigDigest: ${result.digests?.checkConfigDigest}`,
  ];
  return { exitCode: 0, lines };
}
