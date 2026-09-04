import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { AuditRun, EvidenceArtifact, PortalOverlapComparison, PublishedPortalAssessment } from "@panchnama/schema";
import type { PublicationSummary } from "./transform.js";

/**
 * Atomic publish writer — implementation.md section 14 Session 8, "Atomic
 * publication output and audit manifest," and section 4.3's
 * `data/published/` ("validated static datasets consumed by web").
 *
 * Structure (documented choice, per this session's task brief): each
 * publish writes a full historical, atomic per-run artifact at
 * `data/published/<runId>/` (mirroring the `data/raw/{inventory,crawl,
 * analysis}/<runId>/` convention exactly) — `portal-assessments.json`
 * (the `PublishedPortalAssessment[]`) and `summary.json` (the
 * `PublicationSummary` — portal/severity/action counts, audit date,
 * methodology version, and limitations, satisfying §5.14's "every exported
 * result must include audit date, methodology version, and limitations").
 * Alongside that, `data/published/current` is a plain-text pointer file —
 * exactly the same "latest" convention already used by every prior
 * pipeline stage — naming the runId the Next.js web app (Session 11+)
 * should read at build time. `current` is only advanced by an explicit
 * publish; it is never implicitly "whatever the newest directory is."
 *
 * Never silently overwrite an already-published run: publishing the same
 * `runId` twice refuses unless `overwrite` is explicitly passed, matching
 * every other pipeline stage's convention and this session's own exit
 * criterion ("a rerun cannot overwrite review decisions silently" — the
 * published output must be equally non-destructible by accident).
 */
export function writePublishedRunAtomic(params: {
  publishedDir: string;
  runId: string;
  assessments: PublishedPortalAssessment[];
  summary: PublicationSummary;
  /** Only the artifacts actually cited by a published finding or a
   * published overlap comparison (see `transformToPublication`) — this is
   * the ONLY evidence `data/published/` ever exposes, so the web app never
   * has to read the raw, pre-review analysis corpus. */
  evidenceArtifacts: EvidenceArtifact[];
  /** Only overlap comparisons actually selected for a published assessment
   * (§7.6's manual-review-first workflow) — usually empty. */
  overlapComparisons: PortalOverlapComparison[];
  /** The crawl run's own `AuditRun` record — already schema-valid, already
   * loaded by `loadRunBundle` for `methodologyVersion`/`limitations`
   * (see load-run.ts). Copied into `data/published/<runId>/` verbatim so
   * the web app (which only ever reads `data/published/`, never
   * `data/raw/`) can render audit date/status/coverage without reaching
   * outside the published boundary. */
  auditRun: AuditRun;
  overwrite?: boolean;
}): { outputDir: string } {
  const finalDir = join(params.publishedDir, params.runId);
  if (existsSync(finalDir) && params.overwrite !== true) {
    throw new Error(
      `refusing to overwrite existing published output at "${finalDir}" — never silently overwrite an already-published run (implementation.md section 9.2). Use a different --run-id, or pass an explicit override.`,
    );
  }

  mkdirSync(params.publishedDir, { recursive: true });
  const stagingDir = mkdtempSync(join(params.publishedDir, ".staging-"));

  try {
    const sortedAssessments = [...params.assessments].sort((a, b) =>
      a.portal.id.localeCompare(b.portal.id),
    );
    writeFileSync(
      join(stagingDir, "portal-assessments.json"),
      `${JSON.stringify(sortedAssessments, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "summary.json"),
      `${JSON.stringify(params.summary, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "evidence-artifacts.json"),
      `${JSON.stringify(params.evidenceArtifacts, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "overlap-comparisons.json"),
      `${JSON.stringify(params.overlapComparisons, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(stagingDir, "audit-run.json"),
      `${JSON.stringify(params.auditRun, null, 2)}\n`,
      "utf8",
    );

    if (existsSync(finalDir)) {
      rmSync(finalDir, { recursive: true, force: true });
    }
    renameSync(stagingDir, finalDir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }

  const currentPath = join(params.publishedDir, "current");
  const currentTmpPath = join(params.publishedDir, `.current-${params.runId}.tmp`);
  writeFileSync(currentTmpPath, `${params.runId}\n`, "utf8");
  renameSync(currentTmpPath, currentPath);

  return { outputDir: finalDir };
}

export function readCurrentPublishedRunId(publishedDir: string): string | undefined {
  const currentPath = join(publishedDir, "current");
  if (!existsSync(currentPath)) {
    return undefined;
  }
  return readFileSync(currentPath, "utf8").trim() || undefined;
}

export function loadPublishedRun(
  publishedDir: string,
  runId: string,
): { assessments: PublishedPortalAssessment[]; summary: PublicationSummary } | undefined {
  const dir = join(publishedDir, runId);
  if (!existsSync(dir)) {
    return undefined;
  }
  const assessments = JSON.parse(
    readFileSync(join(dir, "portal-assessments.json"), "utf8"),
  ) as PublishedPortalAssessment[];
  const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")) as PublicationSummary;
  return { assessments, summary };
}
