import Link from "next/link";
import type { PublishedPortalAssessment } from "@panchnama/schema";
import {
  countByTechnicalHealth,
  countBySeverity,
  countBySuggestedAction,
  directoryMismatchFindings,
  topPriorityFindings,
} from "@/lib/overviewSummary";
import { EmptyState } from "@/components/EmptyState";
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
  assessments: PublishedPortalAssessment[];
}

/** Directory mismatches shown inline before collapsing to a "+N more, see
 * inventory" link — the real published run can carry dozens of these
 * (one per portal whose directory entry points at an already-unavailable
 * destination), which would otherwise make this a very long page. */
const MISMATCH_DISPLAY_LIMIT = 5;

/**
 * Session 12 ("Assam overview") — implementation.md section 14. The
 * counts/priority-findings/directory-mismatch content of the overview,
 * factored out of `app/page.tsx` so it can be rendered directly in tests
 * against synthetic assessment arrays (including an empty one — the
 * session's own "no-findings dataset" test case, which the real fixture
 * data no longer exercises now that it has priority and directory
 * mismatch findings). `app/page.tsx` wires real published data into this;
 * nothing here reads that data source itself. The technical-health/
 * severity/suggested-action counts are grouped side by side in one
 * unlabeled wrapper `<div>` (three nested `<section>`s inside it, each
 * still its own accessible landmark with a real heading — no orphaned
 * `aria-labelledby` even without a wrapping heading of its own) instead
 * of three separate top-level sections with their own intro paragraphs,
 * and priority findings / directory mismatches are laid out side by side
 * — a later, deliberate density pass to cut down how much the page
 * scrolls, not the original session's layout.
 *
 * "Limitations" and "Where to investigate next" — Session 12's original
 * final two sections — were removed (a later trim): the raw limitations
 * list and the run-status/not-assessable-portal content moved to
 * `/methodology`'s "Known limitations" section rather than living here
 * too, and the entry-point links were dropped as redundant with the
 * header nav.
 */
export function OverviewContent({ assessments }: OverviewContentProps) {
  const healthCounts = countByTechnicalHealth(assessments);
  const severityCounts = countBySeverity(assessments);
  const actionCounts = countBySuggestedAction(assessments);
  const priorityFindings = topPriorityFindings(assessments, 5);
  const mismatches = directoryMismatchFindings(assessments);
  const shownMismatches = mismatches.slice(0, MISMATCH_DISPLAY_LIMIT);
  const hiddenMismatchCount = mismatches.length - shownMismatches.length;

  return (
    <>
      <div className={styles.section}>
        <div className={styles.glanceRow}>
          <section className={styles.glanceGroup} aria-labelledby="technical-health-heading">
            <h2 id="technical-health-heading">Technical health</h2>
            <ul className={styles.countGrid}>
              {TECHNICAL_HEALTH_ORDER.map((status) => (
                <li key={status} className={styles.countTile}>
                  <StatusBadge status={status} />
                  <span className={styles.countValue}>{healthCounts[status]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.glanceGroup} aria-labelledby="severity-heading">
            <h2 id="severity-heading">Findings by severity</h2>
            <ul className={styles.countGrid}>
              {SEVERITY_ORDER.map((severity) => (
                <li key={severity} className={styles.countTile}>
                  <SeverityMarker severity={severity} />
                  <span className={styles.countValue}>{severityCounts[severity]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.glanceGroup} aria-labelledby="action-heading">
            <h2 id="action-heading">Suggested actions</h2>
            <ul className={styles.countGrid}>
              {SUGGESTED_ACTION_ORDER.map((action) => (
                <li key={action} className={styles.countTile}>
                  <span>{SUGGESTED_ACTION_VISUALS[action].label}</span>
                  <span className={styles.countValue}>{actionCounts[action]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className={styles.findingsRow}>
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
          {shownMismatches.length > 0 ? (
            <>
              <ul className={styles.findingList}>
                {shownMismatches.map(({ finding, portalName }) => (
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
              {hiddenMismatchCount > 0 ? (
                <p className={styles.moreLink}>
                  +{hiddenMismatchCount} more — browse every portal&rsquo;s findings in the{" "}
                  <Link href="/inventory">full inventory</Link>.
                </p>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No directory mismatches found"
              description="No reviewed directory mismatch findings exist for this audit run yet."
            />
          )}
        </section>
      </div>
    </>
  );
}
