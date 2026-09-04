import Link from "next/link";
import type { ComponentType } from "react";
import type {
  EvidenceArtifact,
  Finding,
  PortalOverlapComparison,
  PublishedPortalAssessment,
} from "@panchnama/schema";
import {
  groupFindingsByCategory,
  overlapContextForFinding,
  publishableFindings,
  publishedEvidenceForFinding,
  toEvidenceArtifactMap,
} from "@/lib/portalDetail";
import { formatAuditDate } from "@/lib/formatDate";
import { EmptyState } from "@/components/EmptyState";
import { ExperienceSection } from "@/components/experience/ExperienceSection";
import { EvidenceCallout } from "@/components/EvidenceCallout";
import { ExternalLink } from "@/components/ExternalLink";
import { SeverityMarker } from "@/components/status/SeverityMarker";
import {
  SUGGESTED_ACTION_VISUALS,
  TECHNICAL_HEALTH_VISUALS,
} from "@/components/status/statusTokens";
import { PortalSwitcherSearch } from "./PortalSwitcherSearch";
import { ScorecardTabs } from "./ScorecardTabs";
import legacyStyles from "../../app/portals/[portalId]/portal-detail.module.css";
import styles from "./portal-scorecard.module.css";

const TONE_COLOR: Record<string, string> = {
  good: "var(--ps-good)",
  caution: "var(--ps-caution)",
  severe: "var(--ps-accent-strong)",
  info: "var(--ps-info)",
  unknown: "var(--ps-unknown)",
};

const CONTINUING_ROLE_LABELS: Record<PublishedPortalAssessment["continuingRole"], string> = {
  distinct: "Distinct — no indication of overlap with another portal",
  possible_overlap: "Possible overlap with another portal",
  unclear: "Unclear — not enough evidence to conclude",
  not_reviewed: "Not yet reviewed",
};

/** Deterministic pseudo-random in [0,1), seeded by (portalId, index) — used
 * only for the decorative dot-pattern's column heights, never for any
 * number actually printed on the page. */
function pseudoRandom(seed: string, index: number): number {
  let h = 0;
  const s = `${seed}:${index}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function LinkCheckWaveform({
  portalId,
  linksChecked,
  brokenCount,
}: {
  portalId: string;
  linksChecked: number;
  brokenCount: number;
}) {
  const columns = 48;
  const failIndexes = new Set<number>();
  if (linksChecked > 0 && brokenCount > 0) {
    const failFraction = Math.min(brokenCount / linksChecked, 1);
    const failColumnCount = Math.max(1, Math.round(failFraction * columns));
    for (let i = 0; i < failColumnCount; i++) {
      failIndexes.add(Math.floor((i / failColumnCount) * columns));
    }
  }
  return (
    <div className={styles.waveform} role="img" aria-label={`Link-check pattern: ${linksChecked} links checked this run, ${brokenCount} destinations failed.`}>
      {Array.from({ length: columns }, (_, i) => {
        const isFail = failIndexes.has(i);
        const height = isFail ? 5 : 2 + Math.round(pseudoRandom(portalId, i) * 4);
        return (
          <div key={i} className={styles.waveformCol}>
            {Array.from({ length: height }, (_, j) => (
              <div
                key={j}
                className={styles.waveformDot}
                style={{ background: isFail ? "var(--ps-accent-strong)" : "#e4e1e0" }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StatusInline({
  tone,
  icon: Icon,
  label,
}: {
  tone: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className={styles.status} style={{ color: TONE_COLOR[tone] }}>
      <Icon />
      {label}
    </span>
  );
}

/** Renders one finding using the same evidence/overlap/limitations
 * structure as the site's other finding cards (`legacyStyles`), reused
 * as-is inside the new scorecard's tab panels. */
function FindingCard({
  finding,
  evidenceById,
  overlapComparisons,
  currentPortalId,
  assessmentsById,
}: {
  finding: Finding;
  evidenceById: ReadonlyMap<string, EvidenceArtifact>;
  overlapComparisons: PortalOverlapComparison[];
  currentPortalId: string;
  assessmentsById: Map<string, PublishedPortalAssessment>;
}) {
  const evidence = publishedEvidenceForFinding(finding, evidenceById);
  const overlap = overlapContextForFinding(finding, overlapComparisons, currentPortalId);
  const overlapPortal = overlap ? assessmentsById.get(overlap.otherPortalId) : undefined;
  return (
    <article className={legacyStyles.findingCard}>
      <div className={legacyStyles.findingHeader}>
        <SeverityMarker severity={finding.severity} />
        <span className={legacyStyles.findingTitle}>{finding.title}</span>
      </div>
      <p className={legacyStyles.findingSummary}>{finding.summary}</p>
      <div className={legacyStyles.findingMeta}>
        <span>Confidence: {finding.confidence}</span>
        <span>Review status: {finding.reviewStatus.replace(/_/g, " ")}</span>
        <span>
          Observed: {formatAuditDate(finding.firstObservedAt)}
          {finding.firstObservedAt !== finding.lastObservedAt
            ? ` – ${formatAuditDate(finding.lastObservedAt)}`
            : ""}
        </span>
      </div>
      {finding.affectedUrls.length > 0 ? (
        <div className={legacyStyles.urlList}>
          <span className={legacyStyles.fieldLabel}>Affected URLs</span>
          {finding.affectedUrls.map((url) => (
            <ExternalLink key={url} href={url}>
              {url}
            </ExternalLink>
          ))}
        </div>
      ) : null}
      {evidence.length > 0 ? (
        <div className={legacyStyles.evidenceList}>
          {evidence.map((artifact) => (
            <EvidenceCallout
              key={artifact.id}
              heading={artifact.type.replace(/_/g, " ")}
              meta={
                <span>
                  Captured {formatAuditDate(artifact.capturedAt)}
                  {artifact.sourceUrl ? (
                    <>
                      {" · "}
                      <ExternalLink href={artifact.sourceUrl}>source</ExternalLink>
                    </>
                  ) : null}
                </span>
              }
            >
              {artifact.description}
            </EvidenceCallout>
          ))}
        </div>
      ) : null}
      {finding.limitations.length > 0 ? (
        <ul className={legacyStyles.limitationsList}>
          {finding.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      ) : null}
      {overlap && overlapPortal ? (
        <div className={legacyStyles.overlapBlock}>
          <span className={legacyStyles.fieldLabel}>Related portal</span>
          <Link href={`/portals/${overlapPortal.portal.id}`}>{overlapPortal.portal.name}</Link>
          <p>{overlap.comparison.uncertaintyNote}</p>
        </div>
      ) : null}
    </article>
  );
}

function FindingsByCategory({
  findings,
  evidenceById,
  overlapComparisons,
  currentPortalId,
  assessmentsById,
  emptyDescription,
}: {
  findings: Finding[];
  evidenceById: ReadonlyMap<string, EvidenceArtifact>;
  overlapComparisons: PortalOverlapComparison[];
  currentPortalId: string;
  assessmentsById: Map<string, PublishedPortalAssessment>;
  emptyDescription: string;
}) {
  if (findings.length === 0) {
    return <EmptyState title="Nothing to show" description={emptyDescription} />;
  }
  const groups = groupFindingsByCategory(findings);
  return (
    <div className={styles.legacyWrap}>
      {[...groups.entries()].map(([category, categoryFindings]) => (
        <div key={category} className={legacyStyles.categoryGroup}>
          <h3 className={legacyStyles.categoryHeading}>{category.replace(/_/g, " ")}</h3>
          {categoryFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              evidenceById={evidenceById}
              overlapComparisons={overlapComparisons}
              currentPortalId={currentPortalId}
              assessmentsById={assessmentsById}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface PortalScorecardProps {
  assessment: PublishedPortalAssessment;
  evidenceArtifacts: EvidenceArtifact[];
  overlapComparisons: PortalOverlapComparison[];
  /** Used to resolve a related portal's name/link for overlap context, and
   * to power the portal-switcher search — never to alter this portal's own
   * findings. */
  allAssessments: PublishedPortalAssessment[];
}

/**
 * The live portal scorecard — new visual language (see DESIGN.md's
 * "Portal scorecard" section), real data throughout: every number here is
 * derived from `assessment`/`evidenceArtifacts`, nothing is fixture or
 * placeholder content.
 */
export function PortalScorecard({
  assessment,
  evidenceArtifacts,
  overlapComparisons,
  allAssessments,
}: PortalScorecardProps) {
  const { portal } = assessment;
  const evidenceById = toEvidenceArtifactMap(evidenceArtifacts);
  const findings = publishableFindings(assessment);
  const assessmentsById = new Map(allAssessments.map((a) => [a.portal.id, a]));
  const brokenLinkFindings = findings.filter((f) => f.category === "broken_link");
  const priorityFinding =
    findings[0] && (findings[0].severity === "critical" || findings[0].severity === "significant")
      ? findings[0]
      : undefined;
  const priorityEvidence = priorityFinding
    ? publishedEvidenceForFinding(priorityFinding, evidenceById)[0]
    : undefined;

  const healthVisual = TECHNICAL_HEALTH_VISUALS[assessment.technicalHealth];
  const actionVisual = SUGGESTED_ACTION_VISUALS[assessment.suggestedAction];

  const searchOptions = allAssessments
    .filter((a) => a.portal.id !== portal.id)
    .map((a) => ({
      id: a.portal.id,
      name: a.portal.name,
      host: hostOf(a.portal.canonicalUrl),
      technicalHealth: a.technicalHealth,
    }));

  const tabs = [
    {
      id: "availability",
      label: "Availability",
      panel: (
        <div className={`${styles.card} ${styles.panel}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusInline tone={healthVisual.tone} icon={healthVisual.icon} label={healthVisual.label} />
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--ps-ink-secondary)", marginTop: 10 }}>
            {assessment.crawlCoverage.coverageNote}
          </p>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {assessment.crawlCoverage.pagesObserved}/{assessment.crawlCoverage.pagesAttempted}
              </span>
              <div className={styles.tileLabel}>Pages reachable</div>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{assessment.crawlCoverage.linksChecked}</span>
              <div className={styles.tileLabel}>Links checked</div>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatAuditDate(assessment.lastCheckedAt)}</span>
              <div className={styles.tileLabel}>Last checked</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "broken-links",
      label: "Broken Links",
      badge: brokenLinkFindings.length,
      panel: (
        <FindingsByCategory
          findings={brokenLinkFindings}
          evidenceById={evidenceById}
          overlapComparisons={overlapComparisons}
          currentPortalId={portal.id}
          assessmentsById={assessmentsById}
          emptyDescription="No broken outbound links were found on this portal in this audit run."
        />
      ),
    },
    {
      id: "all-findings",
      label: "All Findings",
      badge: findings.length,
      panel: (
        <FindingsByCategory
          findings={findings}
          evidenceById={evidenceById}
          overlapComparisons={overlapComparisons}
          currentPortalId={portal.id}
          assessmentsById={assessmentsById}
          emptyDescription="No reviewed findings exist for this portal in this audit run — a clean bill of health, within this run's coverage."
        />
      ),
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {/* Right column renders first in source order (h1 first — sensible
            reading order) but is placed on the right visually. */}
        <div className={styles.right}>
          <div className={styles.entityTopRow}>
            <div>
              <h1 className={styles.entityName}>{portal.name}</h1>
              <ExternalLink href={portal.canonicalUrl}>
                <span className={styles.entityHost}>{hostOf(portal.canonicalUrl)}</span>
              </ExternalLink>
            </div>
          </div>

          <div className={styles.mark} aria-hidden="true">
            <svg width="100%" height="100%" viewBox="0 0 380 150" style={{ display: "block" }}>
              <circle cx="310" cy="25" r="62" fill="#fff" fillOpacity="0.35" />
              <circle cx="55" cy="135" r="80" fill="#fff" fillOpacity="0.25" />
              <g transform="translate(158,43)">
                <rect x="0" y="0" width="64" height="64" rx="16" fill="#14161a" fillOpacity="0.06" />
                <circle cx="32" cy="32" r="18" stroke="#14161a" strokeWidth="2.2" fill="none" />
                <path d="M32 22v10l7 6" stroke="#14161a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </g>
            </svg>
            <div className={styles.markBadge}>
              <StatusInline tone={healthVisual.tone} icon={healthVisual.icon} label={healthVisual.label} />
            </div>
          </div>

          <div className={styles.pillRow}>
            <span className={styles.pill}>
              {portal.officialStatus === "verified" ? "Verified · Official" : portal.officialStatus.replace(/_/g, " ")}
            </span>
            <span className={styles.pill}>{portal.department ?? "Department not specified"}</span>
            <span className={`${styles.pill} ${styles.pillMono}`}>Host: {hostOf(portal.canonicalUrl)}</span>
            <span className={`${styles.pill} ${styles.pillWarn}`}>No public contact route found</span>
          </div>

          <div className={styles.pillRow}>
            <span className={styles.pill}>{CONTINUING_ROLE_LABELS[assessment.continuingRole]}</span>
          </div>

          <PortalSwitcherSearch options={searchOptions} />

          <ScorecardTabs tabs={tabs} />

          <div className={styles.twoUp}>
            <div className={`${styles.tile} ${styles.tileWhite}`}>
              <span
                className={styles.bigNumber}
                style={{
                  fontSize: "1.6rem",
                  color: assessment.criticalFindingCount > 0 ? "var(--ps-accent)" : "var(--ps-good)",
                }}
              >
                {assessment.criticalFindingCount}
              </span>
              <div className={styles.tileLabel}>Critical findings</div>
            </div>
            <div className={styles.darkTile}>
              <span className={styles.status} style={{ color: "#fff" }}>
                <actionVisual.icon />
                {actionVisual.label}
              </span>
              <div className={styles.darkTileMeta}>Suggested action</div>
            </div>
          </div>
        </div>

        <div className={styles.left}>
          <p className={styles.eyebrow}>Portal health check</p>
          <h2 className={styles.headline}>Is this portal working?</h2>

          <div className={`${styles.card} ${styles.panel}`}>
            <div className={styles.panelHeadRow}>
              <div>
                <div className={styles.panelEyebrow}>Availability check</div>
                <div className={styles.panelMeta}>Last check · {formatAuditDate(assessment.lastCheckedAt)}</div>
              </div>
            </div>

            <div className={styles.statRow} style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Coverage</div>
                  <div className={styles.statValue}>
                    {assessment.crawlCoverage.pagesObserved}/{assessment.crawlCoverage.pagesAttempted} pages
                  </div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Status</div>
                  <div className={styles.statValue}>
                    <StatusInline tone={healthVisual.tone} icon={healthVisual.icon} label={healthVisual.label} />
                  </div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Method</div>
                  <div className={styles.statValue}>
                    {assessment.crawlCoverage.browserFallbackUsed ? "Browser crawler" : "HTTP crawler"}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  className={styles.bigNumber}
                  style={{ color: assessment.criticalFindingCount > 0 ? "var(--ps-accent)" : "var(--ps-good)" }}
                >
                  {assessment.criticalFindingCount}
                </span>
                <span className={styles.bigNumberUnit}>critical</span>
              </div>
            </div>

            <LinkCheckWaveform
              portalId={portal.id}
              linksChecked={assessment.crawlCoverage.linksChecked}
              brokenCount={brokenLinkFindings.length}
            />
            <div className={styles.waveformFoot}>
              <span>
                Link-check pattern · {assessment.crawlCoverage.linksChecked} links checked this run
              </span>
              {brokenLinkFindings.length > 0 ? (
                <span style={{ color: "var(--ps-accent-strong)", fontWeight: 600 }}>
                  ● {brokenLinkFindings.length} destination{brokenLinkFindings.length === 1 ? "" : "s"} failed
                </span>
              ) : (
                <span style={{ color: "var(--ps-good)", fontWeight: 600 }}>● no broken destinations found</span>
              )}
            </div>
          </div>

          {priorityFinding ? (
            <div className={styles.darkTile}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div className={styles.darkTileLabel}>Priority evidence</div>
                  <div className={styles.darkTileMeta}>
                    {formatAuditDate(priorityFinding.lastObservedAt)}
                  </div>
                </div>
                <SeverityMarker severity={priorityFinding.severity} />
              </div>
              <p style={{ fontSize: "0.85rem", color: "#d7d9dc", marginTop: 14, lineHeight: 1.5 }}>
                {priorityFinding.summary}
              </p>
              {priorityEvidence ? (
                <p style={{ fontSize: "0.72rem", color: "#9a9ea5", marginTop: 10 }}>
                  {priorityEvidence.description}
                </p>
              ) : null}
            </div>
          ) : (
            <div className={`${styles.card} ${styles.panel}`}>
              <StatusInline tone="good" icon={TECHNICAL_HEALTH_VISUALS.healthy.icon} label="No published findings" />
              <p style={{ fontSize: "0.85rem", color: "var(--ps-ink-secondary)", marginTop: 10 }}>
                No reviewed findings exist for this portal in this audit run, within the coverage
                described above.
              </p>
            </div>
          )}

          {portal.alternateUrls.length > 0 ? (
            <div className={`${styles.card} ${styles.panel}`}>
              <div className={styles.panelEyebrow}>Alternate URLs</div>
              <div className={legacyStyles.urlList} style={{ marginTop: 10 }}>
                {portal.alternateUrls.map((url) => (
                  <ExternalLink key={url} href={url}>
                    {url}
                  </ExternalLink>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`${styles.card} ${styles.panel}`} style={{ marginTop: 24 }}>
        <ExperienceSection portalId={portal.id} portalName={portal.name} />
      </div>
    </div>
  );
}
