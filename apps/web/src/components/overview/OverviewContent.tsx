import Link from "next/link";
import type { AuditRun, PublishedPortalAssessment } from "@panchnama/schema";
import {
  countByTechnicalHealth,
  countBySeverity,
  countBySuggestedAction,
  directoryMismatchFindings,
  notAssessablePortals,
  topPriorityFindings,
} from "@/lib/overviewSummary";
import { EmptyState } from "@/components/EmptyState";
import { EvidenceCallout } from "@/components/EvidenceCallout";
import { SeverityMarker } from "@/components/status/SeverityMarker";
import { StatusBadge } from "@/components/status/StatusBadge";
import { SUGGESTED_ACTION_VISUALS } from "@/components/status/statusTokens";
import styles from "../../app/overview.module.css";

const TECHNICAL_HEALTH_ORDER = ["healthy", "degraded", "unavailable", "not_assessable"] as const;
const SEVERITY_ORDER = ["critical", "significant", "advisory"] as const;
const SUGGESTED_ACTION_ORDER = [
  "repair",
  "review_consolidation",
  "review_retirement",
  "manual_assessment",
  "maintain",
] as const;

export interface OverviewContentProps {
  auditRun: AuditRun;
  assessments: PublishedPortalAssessment[];
}

/**
 * Session 12 ("Assam overview") — implementation.md section 14. The
 * counts/priority-findings/directory-mismatch/limitations content of the
 * overview, factored out of `app/page.tsx` so it can be rendered directly
 * in tests against synthetic assessment arrays (including an empty one —
 * the session's own "no-findings dataset" test case, which the real
 * fixture data no longer exercises now that it has priority and directory
 * mismatch findings). `app/page.tsx` wires real fixture data into this;
 * nothing here reads fixtures itself.
 */
export function OverviewContent({ auditRun, assessments }: OverviewContentProps) {
  const healthCounts = countByTechnicalHealth(assessments);
  const severityCounts = countBySeverity(assessments);
  const actionCounts = countBySuggestedAction(assessments);
  const priorityFindings = topPriorityFindings(assessments, 5);
  const mismatches = directoryMismatchFindings(assessments);
  const unassessable = notAssessablePortals(assessments);

  const isPartialRun = auditRun.status === "partial" || auditRun.status === "failed";

  return (
    <>
      <section className={styles.section} aria-labelledby="technical-health-heading">
        <h2 id="technical-health-heading">Technical health</h2>
        <p className={styles.sectionIntro}>
          Every portal in the observed estate, grouped by its measured technical health (
          implementation.md section 7.7). A &ldquo;healthy&rdquo; result reflects the coverage and
          methodology described below — it is not a certification.
        </p>
        <ul className={styles.countGrid}>
          {TECHNICAL_HEALTH_ORDER.map((status) => (
            <li key={status} className={styles.countTile}>
              <StatusBadge status={status} />
              <span className={styles.countValue}>{healthCounts[status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="severity-heading">
        <h2 id="severity-heading">Findings by severity</h2>
        <p className={styles.sectionIntro}>
          The number of reviewed findings at each severity level, across all portals.
        </p>
        <ul className={styles.countGrid}>
          {SEVERITY_ORDER.map((severity) => (
            <li key={severity} className={styles.countTile}>
              <SeverityMarker severity={severity} />
              <span className={styles.countValue}>{severityCounts[severity]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="action-heading">
        <h2 id="action-heading">Suggested actions</h2>
        <p className={styles.sectionIntro}>
          What each portal&rsquo;s evidence suggests happens next (implementation.md section 7.8) —
          never a retirement decision from downtime alone.
        </p>
        <ul className={styles.countGrid}>
          {SUGGESTED_ACTION_ORDER.map((action) => (
            <li key={action} className={styles.countTile}>
              <span>{SUGGESTED_ACTION_VISUALS[action].label}</span>
              <span className={styles.countValue}>{actionCounts[action]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="priority-heading">
        <h2 id="priority-heading">Priority findings</h2>
        <p className={styles.sectionIntro}>
          The highest-severity, most recently observed reviewed findings across the estate.
        </p>
        {priorityFindings.length > 0 ? (
          <ul className={styles.findingList}>
            {priorityFindings.map(({ finding, portalName }) => (
              <li key={finding.id} className={styles.findingItem}>
                <div className={styles.findingHeader}>
                  <SeverityMarker severity={finding.severity} />
                  <span className={styles.findingTitle}>{finding.title}</span>
                </div>
                <span className={styles.findingPortal}>{portalName}</span>
                <p className={styles.findingSummary}>{finding.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No priority findings"
            description="No reviewed critical, significant, or advisory findings exist for this audit run yet."
          />
        )}
      </section>

      <section className={styles.section} aria-labelledby="mismatch-heading">
        <h2 id="mismatch-heading">Directory mismatch summary</h2>
        <p className={styles.sectionIntro}>
          Cases where the state directory and the observed portal disagree (implementation.md
          section 7.5) — reported separately from technical health.
        </p>
        {mismatches.length > 0 ? (
          <ul className={styles.findingList}>
            {mismatches.map(({ finding, portalName }) => (
              <li key={finding.id} className={styles.findingItem}>
                <div className={styles.findingHeader}>
                  <SeverityMarker severity={finding.severity} />
                  <span className={styles.findingTitle}>{finding.title}</span>
                </div>
                <span className={styles.findingPortal}>{portalName}</span>
                <p className={styles.findingSummary}>{finding.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No directory mismatches found"
            description="No reviewed directory mismatch findings exist for this audit run yet."
          />
        )}
      </section>

      <section className={styles.section} aria-labelledby="limitations-heading">
        <h2 id="limitations-heading">Limitations</h2>
        <EvidenceCallout
          heading="What this audit run did not establish"
          meta={
            <span>
              Audit run {auditRun.id} — methodology v{auditRun.methodologyVersion}
            </span>
          }
        >
          <ul className={styles.limitationsList}>
            {auditRun.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
          {isPartialRun ? (
            <p>
              This audit run is marked &ldquo;{auditRun.status}&rdquo;: not every portal could be
              fully assessed. See below for portals that could not be fairly assessed at all.
            </p>
          ) : null}
          {unassessable.length > 0 ? (
            <ul className={styles.notAssessableList}>
              {unassessable.map((portal) => (
                <li key={portal.portalId}>
                  <strong>{portal.portalName}:</strong> {portal.coverageNote}
                </li>
              ))}
            </ul>
          ) : null}
        </EvidenceCallout>
      </section>

      <section className={styles.section} aria-labelledby="next-heading">
        <h2 id="next-heading">Where to investigate next</h2>
        <nav aria-label="Investigate further" className={styles.entryPoints}>
          <Link className={styles.entryPointLink} href="/inventory">
            Browse the full website inventory
          </Link>
          <Link className={styles.entryPointLink} href="/methodology">
            Read the methodology
          </Link>
          <Link className={styles.entryPointLink} href="/exports">
            Download the audit dataset
          </Link>
        </nav>
      </section>
    </>
  );
}
