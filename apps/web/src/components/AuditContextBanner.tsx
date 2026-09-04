import type { AuditRun } from "@panchnama/schema";
import { formatAuditDate } from "@/lib/formatDate";
import styles from "./layout.module.css";

export interface AuditContextBannerProps {
  auditRun: Pick<AuditRun, "completedAt" | "startedAt" | "geography">;
}

/**
 * A persistent strip (present on every page — implementation.md section
 * 10.1's global requirements) stating the audit date and coverage, so a
 * reader never has to hunt for "when was this last checked, and what does
 * it cover" or leave the page unsure whether they are looking at a live
 * service or a dated snapshot (section 1.6 principle 7). Session 12
 * ("Assam overview") is expected to reuse this component rather than
 * re-derive its own audit-context summary.
 *
 * Deliberately does not show the raw run status ("partial"/"completed")
 * or a portal count here — those read as case-study/prototype internals,
 * not something a visitor to a live product needs on every page; the
 * portal-count breakdown already lives on the overview itself. Also
 * deliberately carries no Methodology/Download-data links of its own
 * (a later trim) — the header nav's "Methodology" entry and the
 * overview's own "Where to investigate next" links already cover both,
 * so repeating them here on every single page was redundant.
 */
export function AuditContextBanner({ auditRun }: AuditContextBannerProps) {
  const dateLabel = auditRun.completedAt
    ? formatAuditDate(auditRun.completedAt)
    : `started ${formatAuditDate(auditRun.startedAt)}`;
  const coverageLabel = auditRun.geography.charAt(0).toUpperCase() + auditRun.geography.slice(1);

  return (
    <div className={styles.banner} role="region" aria-label="Audit context">
      <div className={styles.bannerInner}>
        <span className={styles.bannerItem}>
          <span className={styles.bannerLabel}>Last audited:</span>
          <span className={styles.bannerValue}>{dateLabel}</span>
        </span>
        <span className={styles.bannerItem}>
          <span className={styles.bannerLabel}>Coverage:</span>
          <span className={styles.bannerValue}>{coverageLabel}</span>
        </span>
      </div>
    </div>
  );
}
