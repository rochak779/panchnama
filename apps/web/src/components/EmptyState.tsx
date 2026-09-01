import type { ReactNode } from "react";
import { InfoIcon } from "./icons";
import styles from "./states.module.css";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * A designed "nothing here yet" state — not an afterthought. Distinct from
 * ErrorState: an EmptyState means the request succeeded and genuinely
 * found nothing (implementation.md section 10.6: an empty citizen-
 * experience section should invite the first experience "without implying
 * no one has had problems" — the copy calling this component, not the
 * component itself, carries that nuance).
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.stateBlock} role="status">
      <InfoIcon className={styles.stateIcon} />
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateDescription}>{description}</p>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </div>
  );
}
