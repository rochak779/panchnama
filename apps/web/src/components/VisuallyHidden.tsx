import type { ReactNode } from "react";
import styles from "./VisuallyHidden.module.css";

export interface VisuallyHiddenProps {
  children: ReactNode;
}

/**
 * Renders content that stays reachable by assistive technology while being
 * clipped out of the visual layout — the standard clip-based
 * visually-hidden pattern, not `display:none`/`visibility:hidden` (which
 * screen readers also skip). Used for labels a sighted user does not need
 * to see but a screen reader still must announce, e.g. a label associated
 * with the honeypot field in the submission form (Task 2).
 *
 * The honeypot input itself needs more than this: it must also be pulled
 * out of the tab order (`tabIndex={-1}`) and marked `aria-hidden="true"` on
 * the input, since a screen-reader user filling in visible fields should
 * never land on it either. That belongs to the input element in Task 2,
 * not to this component.
 */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className={styles.visuallyHidden}>{children}</span>;
}
