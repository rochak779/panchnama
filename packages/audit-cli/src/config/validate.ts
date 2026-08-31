import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checksConfigSchema, findDuplicateRuleIds, type ChecksConfig } from "./checks.js";
import { crawlPolicyConfigSchema, type CrawlPolicyConfig } from "./crawl-policy.js";
import { computeConfigDigest } from "./digest.js";
import { type ConfigIssue, loadYamlConfig } from "./load.js";
import { portalOverrideConfigSchema } from "./portal-override.js";
import {
  findDuplicateSourceIds,
  sourceRegistryConfigSchema,
  type SourceRegistryConfig,
} from "./source-registry.js";

/**
 * Full config validation pass — implementation.md section 9.2's
 * `sources:validate` behavior. Validates:
 *   - `config/sources.assam.yaml` (shape + duplicate-id semantics)
 *   - `config/crawl-policy.yaml` (shape; thresholds are enforced by the
 *     Zod schema itself)
 *   - `config/checks.yaml` (shape + duplicate-rule-id semantics)
 *   - every `config/portals/*.yaml` override file (shape only — no
 *     `Portal` records exist yet to cross-check `portalId` against; see
 *     docs/session-log.md "Known limitations")
 *
 * No network activity anywhere in this module.
 */
export interface ConfigValidationResult {
  ok: boolean;
  issues: ConfigIssue[];
  digests?: {
    sourceRegistryDigest: string;
    crawlPolicyDigest: string;
    checkConfigDigest: string;
  };
  sourceCount?: number | undefined;
  portalOverrideCount?: number | undefined;
}

export interface ConfigPaths {
  sourcesFile: string;
  crawlPolicyFile: string;
  checksFile: string;
  portalsDir: string;
}

export function defaultConfigPaths(configDir: string): ConfigPaths {
  return {
    sourcesFile: join(configDir, "sources.assam.yaml"),
    crawlPolicyFile: join(configDir, "crawl-policy.yaml"),
    checksFile: join(configDir, "checks.yaml"),
    portalsDir: join(configDir, "portals"),
  };
}

export function validateAllConfig(paths: ConfigPaths): ConfigValidationResult {
  const issues: ConfigIssue[] = [];

  const sourcesResult = loadYamlConfig<SourceRegistryConfig>(
    paths.sourcesFile,
    sourceRegistryConfigSchema,
  );
  let sourceRegistry: SourceRegistryConfig | undefined;
  if (!sourcesResult.ok) {
    issues.push(...sourcesResult.issues);
  } else {
    sourceRegistry = sourcesResult.value;
    for (const id of findDuplicateSourceIds(sourceRegistry)) {
      issues.push({
        file: paths.sourcesFile,
        path: "sources[]",
        reason: `duplicate source id: "${id}"`,
      });
    }
  }

  const crawlPolicyResult = loadYamlConfig<CrawlPolicyConfig>(
    paths.crawlPolicyFile,
    crawlPolicyConfigSchema,
  );
  let crawlPolicy: CrawlPolicyConfig | undefined;
  if (!crawlPolicyResult.ok) {
    issues.push(...crawlPolicyResult.issues);
  } else {
    crawlPolicy = crawlPolicyResult.value;
  }

  const checksResult = loadYamlConfig<ChecksConfig>(paths.checksFile, checksConfigSchema);
  let checksConfig: ChecksConfig | undefined;
  if (!checksResult.ok) {
    issues.push(...checksResult.issues);
  } else {
    checksConfig = checksResult.value;
    for (const ruleId of findDuplicateRuleIds(checksConfig)) {
      issues.push({
        file: paths.checksFile,
        path: "checks[]",
        reason: `duplicate ruleId: "${ruleId}"`,
      });
    }
  }

  let portalOverrideCount = 0;
  if (existsSync(paths.portalsDir)) {
    const overrideFiles = readdirSync(paths.portalsDir).filter(
      (name) => name.endsWith(".yaml") || name.endsWith(".yml"),
    );
    for (const fileName of overrideFiles) {
      const filePath = join(paths.portalsDir, fileName);
      const result = loadYamlConfig(filePath, portalOverrideConfigSchema);
      if (!result.ok) {
        issues.push(...result.issues);
      } else {
        portalOverrideCount += 1;
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    digests: {
      sourceRegistryDigest: computeConfigDigest(sourceRegistry),
      crawlPolicyDigest: computeConfigDigest(crawlPolicy),
      checkConfigDigest: computeConfigDigest(checksConfig),
    },
    sourceCount: sourceRegistry?.sources.length,
    portalOverrideCount,
  };
}
