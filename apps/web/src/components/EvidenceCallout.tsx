import type { ReactNode } from "react";
import { FileTextIcon } from "./icons";
import styles from "./states.module.css";

export interface EvidenceCalloutProps {
  /** e.g. "Evidence" or a finding's own title — a real heading, never a
   * small eyebrow/kicker label sitting above a separate, larger one. */
  heading: string;
  children: ReactNode;
  /** Citation line: observation timestamp, audit rule id, source URL —
   * whatever grounds this specific claim (implementation.md section 1.6
   * principle 1: "every published finding must cite a URL, observation,
   * timestamp, and audit rule"). */
  meta?: ReactNode;
}

/**
 * A bordered panel that grounds a claim in evidence — the visual
 * reinforcement of "evidence before judgment." Used wherever a finding,
 * summary, or assessment states something the reader should be able to
 * verify (Sessions 12-14 wire real findings/observations into this via
 * `meta`).
 */
export function EvidenceCallout({ heading, children, meta }: EvidenceCalloutProps) {
  return (
    <div className={styles.evidenceCallout}>
      <FileTextIcon className={styles.evidenceIcon} />
      <div className={styles.evidenceBody}>
        <p className={styles.evidenceHeading}>{heading}</p>
        <div className={styles.evidenceContent}>{children}</div>
        {meta ? <div className={styles.evidenceMeta}>{meta}</div> : null}
      </div>
    </div>
  );
}
