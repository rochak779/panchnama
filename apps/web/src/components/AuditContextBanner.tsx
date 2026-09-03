import Link from "next/link";
import type { AuditRun } from "@panchnama/schema";
import { formatAuditDate } from "@/lib/formatDate";
import styles from "./layout.module.css";

export interface AuditContextBannerProps {
  auditRun: Pick<AuditRun, "completedAt" | "startedAt" | "status" | "portalCount">;
}

const STATUS_LABEL: Record<AuditRun["status"], string> = {
  completed: "Completed",
  partial: "Partially completed",
  failed: "Failed",
  running: "In progress",
};

/**
 * A persistent strip (present on every page — implementation.md section
 * 10.1's global requirements) stating the audit date, estate coverage, and
 * links to methodology/downloads, so a reader never has to hunt for "when
 * was this run, and what does it cover" or leave the page unsure whether
 * they are looking at a live service or a dated snapshot (section 1.6
 * principle 7). Session 12 ("Assam overview") is expected to reuse this
 * component rather than re-derive its own audit-context summary.
 */
export function AuditContextBanner({ auditRun }: AuditContextBannerProps) {
  const dateLabel = auditRun.completedAt
    ? formatAuditDate(auditRun.completedAt)
    : `started ${formatAuditDate(auditRun.startedAt)}`;

  return (
    <div className={styles.banner} role="region" aria-label="Audit context">
      <div className={styles.bannerInner}>
        <span className={styles.bannerItem}>
          <span className={styles.bannerLabel}>Audited:</span>
          <span className={styles.bannerValue}>{dateLabel}</span>
        </span>
        <span className={styles.bannerItem}>
          <span className={styles.bannerLabel}>Coverage:</span>
          <span className={styles.bannerValue}>
            {auditRun.portalCount} portal{auditRun.portalCount === 1 ? "" : "s"} in the observed
            estate
          </span>
        </span>
        <span className={styles.bannerItem}>
          <span className={styles.bannerLabel}>Run status:</span>
          <span className={styles.bannerValue}>{STATUS_LABEL[auditRun.status]}</span>
        </span>
        <span className={styles.bannerLinks}>
          <Link href="/methodology">Methodology</Link>
          <Link href="/exports">Download data</Link>
        </span>
      </div>
    </div>
  );
}
