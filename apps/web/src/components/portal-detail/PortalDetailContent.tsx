import Link from "next/link";
import type {
  EvidenceArtifact,
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
import { StatusBadge } from "@/components/status/StatusBadge";
import { SUGGESTED_ACTION_VISUALS } from "@/components/status/statusTokens";
import styles from "../../app/portals/[portalId]/portal-detail.module.css";

const CONTINUING_ROLE_LABELS: Record<PublishedPortalAssessment["continuingRole"], string> = {
  distinct: "Distinct — no indication of overlap with another portal",
  possible_overlap: "Possible overlap with another portal",
  unclear: "Unclear — not enough evidence to conclude",
  not_reviewed: "Not yet reviewed",
};

export interface PortalDetailContentProps {
  assessment: PublishedPortalAssessment;
  evidenceArtifacts: EvidenceArtifact[];
  overlapComparisons: PortalOverlapComparison[];
  /** Used only to resolve a related portal's name/link for overlap context — never to alter this portal's own findings. */
  allAssessments: PublishedPortalAssessment[];
}

/**
 * Session 14 ("Portal evidence pages") — implementation.md section 14 /
 * 10.4. Renders one portal's identity, distinct health/role/action fields,
 * crawl coverage, and every publishable finding grouped by category with
 * its evidence, review status, confidence, limitations, and (when
 * present) related overlap comparison. Factored out of the route's
 * `page.tsx` so it can be exercised directly against synthetic assessment
 * data in tests — including the "many findings," "no findings," and
 * "not assessable" cases implementation.md's own test list asks for.
 *
 * Every fact here traces to a field on the real assessment/finding/
 * evidence records — nothing is summarized into a single verdict beyond
 * what `technicalHealth`/`continuingRole`/`suggestedAction` already are,
 * each rendered as its own distinct, separately labeled field (DESIGN.md's
 * "no composite/blended score" rule).
 */
export function PortalDetailContent({
  assessment,
  evidenceArtifacts,
  overlapComparisons,
  allAssessments,
}: PortalDetailContentProps) {
  const { portal } = assessment;
  const evidenceById = toEvidenceArtifactMap(evidenceArtifacts);
  const findings = publishableFindings(assessment);
  const groups = groupFindingsByCategory(findings);
  const assessmentsById = new Map(allAssessments.map((a) => [a.portal.id, a]));

  return (
    <>
      <div className={styles.header}>
        <h1>{portal.name}</h1>
        <dl className={styles.identityMeta}>
          <dt>Department:</dt>
          <dd>{portal.department ?? "Not specified"}</dd>
          <dt>Canonical URL:</dt>
          <dd>
            <ExternalLink href={portal.canonicalUrl}>{portal.canonicalUrl}</ExternalLink>
          </dd>
          <dt>Official status:</dt>
          <dd>{portal.officialStatus}</dd>
        </dl>
        {portal.description ? <p>{portal.description}</p> : null}
        {portal.alternateUrls.length > 0 ? (
          <div className={styles.urlList}>
            <span className={styles.fieldLabel}>Alternate URLs</span>
            {portal.alternateUrls.map((url) => (
              <ExternalLink key={url} href={url}>
                {url}
              </ExternalLink>
            ))}
          </div>
        ) : null}
        <p className={styles.findingMeta}>
          Source: inventory record {portal.sourceRefs.join(", ")}
        </p>
      </div>

      <section className={styles.section} aria-labelledby="assessment-heading">
        <h2 id="assessment-heading">Assessment</h2>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldTile}>
            <span className={styles.fieldLabel}>Technical health</span>
            <StatusBadge status={assessment.technicalHealth} />
          </div>
          <div className={styles.fieldTile}>
            <span className={styles.fieldLabel}>Continuing role</span>
            <span>{CONTINUING_ROLE_LABELS[assessment.continuingRole]}</span>
          </div>
          <div className={styles.fieldTile}>
            <span className={styles.fieldLabel}>Suggested action</span>
            <span>{SUGGESTED_ACTION_VISUALS[assessment.suggestedAction].label}</span>
          </div>
          <div className={styles.fieldTile}>
            <span className={styles.fieldLabel}>Last checked</span>
            <span>{formatAuditDate(assessment.lastCheckedAt)}</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="coverage-heading">
        <h2 id="coverage-heading">Crawl coverage</h2>
        <EvidenceCallout
          heading="What was actually observed this run"
          meta={
            <span>
              {assessment.crawlCoverage.pagesObserved} of {assessment.crawlCoverage.pagesAttempted}{" "}
              pages observed · {assessment.crawlCoverage.linksChecked} links checked
              {assessment.crawlCoverage.browserFallbackUsed ? " · browser fallback used" : ""}
            </span>
          }
        >
          {assessment.crawlCoverage.coverageNote}
        </EvidenceCallout>
      </section>

      <section className={styles.section} aria-labelledby="findings-heading">
        <h2 id="findings-heading">Findings</h2>
        {findings.length > 0 ? (
          [...groups.entries()].map(([category, categoryFindings]) => (
            <div key={category} className={styles.categoryGroup}>
              <h3 className={styles.categoryHeading}>{category.replace(/_/g, " ")}</h3>
              {categoryFindings.map((finding) => {
                const evidence = publishedEvidenceForFinding(finding, evidenceById);
                const overlap = overlapContextForFinding(finding, overlapComparisons, portal.id);
                const overlapPortal = overlap
                  ? assessmentsById.get(overlap.otherPortalId)
                  : undefined;
                return (
                  <article key={finding.id} className={styles.findingCard}>
                    <div className={styles.findingHeader}>
                      <SeverityMarker severity={finding.severity} />
                      <span className={styles.findingTitle}>{finding.title}</span>
                    </div>
                    <p className={styles.findingSummary}>{finding.summary}</p>
                    <div className={styles.findingMeta}>
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
                      <div className={styles.urlList}>
                        <span className={styles.fieldLabel}>Affected URLs</span>
                        {finding.affectedUrls.map((url) => (
                          <ExternalLink key={url} href={url}>
                            {url}
                          </ExternalLink>
                        ))}
                      </div>
                    ) : null}
                    {evidence.length > 0 ? (
                      <div className={styles.evidenceList}>
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
                      <ul className={styles.limitationsList}>
                        {finding.limitations.map((limitation) => (
                          <li key={limitation}>{limitation}</li>
                        ))}
                      </ul>
                    ) : null}
                    {overlap && overlapPortal ? (
                      <div className={styles.overlapBlock}>
                        <span className={styles.fieldLabel}>Related portal</span>
                        <Link href={`/portals/${overlapPortal.portal.id}`}>
                          {overlapPortal.portal.name}
                        </Link>
                        <p>{overlap.comparison.uncertaintyNote}</p>
                        {overlap.comparison.materialSimilarities.length > 0 ? (
                          <div>
                            <span className={styles.fieldLabel}>Material similarities</span>
                            <ul>
                              {overlap.comparison.materialSimilarities.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {overlap.comparison.materialDifferences.length > 0 ? (
                          <div>
                            <span className={styles.fieldLabel}>Material differences</span>
                            <ul>
                              {overlap.comparison.materialDifferences.map((d) => (
                                <li key={d}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ))
        ) : (
          <EmptyState
            title="No published findings"
            description="No reviewed findings exist for this portal in this audit run."
          />
        )}
      </section>

      <ExperienceSection portalId={portal.id} portalName={portal.name} />
    </>
  );
}
