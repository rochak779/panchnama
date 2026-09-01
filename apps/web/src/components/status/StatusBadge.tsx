import styles from "./status.module.css";
import { TECHNICAL_HEALTH_VISUALS, type StatusVisual } from "./statusTokens";

export interface StatusBadgeProps {
  /** One of `@panchnama/schema`'s `TechnicalHealth` values. Typed as a
   * plain string union here (not imported from the schema package) — see
   * `statusTokens.ts`'s module doc comment for why. */
  status: keyof typeof TECHNICAL_HEALTH_VISUALS;
  className?: string;
}

/**
 * A filled pill communicating a portal's technical health. Never renders
 * color alone: every badge always shows both an icon and the status's text
 * label (implementation.md section 10.9). The bordered/filled tone token
 * itself, not this component, is what a future dark-mode or print
 * stylesheet would need to adjust — nothing here hard-codes a hex value.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const visual: StatusVisual = TECHNICAL_HEALTH_VISUALS[status];
  const Icon = visual.icon;
  return (
    <span className={[styles.badge, styles[`tone-${visual.tone}`], className].join(" ").trim()}>
      <Icon />
      {visual.label}
    </span>
  );
}
