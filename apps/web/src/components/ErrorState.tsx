import type { ReactNode } from "react";
import { AlertTriangleIcon } from "./icons";
import styles from "./states.module.css";

export interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * A designed failure state — e.g. "the database is unavailable" (section
 * 9.8: "the audit scorecard remains readable and the form shows an honest
 * temporary-unavailability state"). `role="alert"` announces it to
 * assistive technology as soon as it mounts, unlike EmptyState's
 * `role="status"` (a normal outcome, not a failure needing interruption).
 */
export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div className={styles.stateBlock} role="alert">
      <AlertTriangleIcon className={[styles.stateIcon, styles.stateIconError].join(" ")} />
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateDescription}>{description}</p>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </div>
  );
}
