import { execFileSync } from "node:child_process";
import { SCHEMA_VERSIONS, type AuditRun } from "@panchnama/schema";
import {
  computeConfigDigest,
  type ChecksConfig,
  type CrawlPolicyConfig,
  type SourceRegistryConfig,
} from "../config/index.js";

/**
 * `AuditRun` manifest builder — implementation.md section 5.4 / 9.2 / 9.4.
 *
 * `methodologyVersion` is a placeholder ("0.1.0") pending a real, versioned
 * methodology document (implementation.md section 10.7, not built until a
 * later session) — recorded honestly as a fixed placeholder rather than
 * fabricated precision, and easy to grep for when that document exists.
 */
export const METHODOLOGY_VERSION_PLACEHOLDER = "0.1.0";

/** Best-effort `git rev-parse HEAD`; returns `undefined` (never throws) when
 * not in a Git checkout or `git` is unavailable — `AuditRun.codeRevision`
 * is optional for exactly this reason. */
export function getCodeRevision(cwd: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

export interface BuildAuditRunParams {
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: AuditRun["status"];
  codeRevision?: string;
  sourceRegistry: SourceRegistryConfig;
  crawlPolicy: CrawlPolicyConfig;
  checksConfig: ChecksConfig;
  portalCount: number;
  portalsSucceeded: number;
  portalsFailed: number;
  portalsPartial: number;
  limitations: string[];
}

export function buildAuditRun(params: BuildAuditRunParams): AuditRun {
  const enabledChecks = params.checksConfig.checks.filter((c) => c.enabled).map((c) => c.ruleId);

  const run: AuditRun = {
    id: params.runId,
    schemaVersion: SCHEMA_VERSIONS.auditRun,
    geography: "assam",
    startedAt: params.startedAt,
    status: params.status,
    methodologyVersion: METHODOLOGY_VERSION_PLACEHOLDER,
    nodeVersion: process.version,
    packageVersionsDigest: computeConfigDigest({
      node: process.version,
      // No lockfile-parsing step exists yet; the resolved package set for
      // this workspace is represented by node's own version plus this
      // package's declared dependency versions, which is what actually
      // changes fetcher/frontier behavior. Documented as an approximation
      // of "digest of the resolved lockfile" (section 5.4) pending a real
      // lockfile-hash step if reproducibility audits need finer grain.
      audit_cli_version: "0.0.0",
    }),
    sourceRegistryDigest: computeConfigDigest(params.sourceRegistry),
    crawlPolicyDigest: computeConfigDigest(params.crawlPolicy),
    checkConfigDigest: computeConfigDigest(params.checksConfig),
    enabledChecks,
    portalCount: params.portalCount,
    portalsSucceeded: params.portalsSucceeded,
    portalsFailed: params.portalsFailed,
    portalsPartial: params.portalsPartial,
    limitations: params.limitations,
  };
  if (params.completedAt !== undefined) {
    run.completedAt = params.completedAt;
  }
  if (params.codeRevision !== undefined) {
    run.codeRevision = params.codeRevision;
  }
  return run;
}
