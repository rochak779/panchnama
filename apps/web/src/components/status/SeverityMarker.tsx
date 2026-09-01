import styles from "./status.module.css";
import { SEVERITY_VISUALS, type StatusVisual } from "./statusTokens";

export interface SeverityMarkerProps {
  /** One of `@panchnama/schema`'s `Severity` values. */
  severity: keyof typeof SEVERITY_VISUALS;
  className?: string;
}

/**
 * An inline marker (icon + label, no filled pill background) used next to
 * a finding — distinct from StatusBadge's filled-pill treatment so a
 * portal's overall technical health and an individual finding's severity
 * are never visually confusable at a glance, even though both borrow the
 * same tone tokens. Each severity also gets its own icon shape (octagon /
 * triangle / circle) so the distinction survives grayscale printing or a
 * color-vision deficiency, not just the color (implementation.md section
 * 10.9).
 */
export function SeverityMarker({ severity, className }: SeverityMarkerProps) {
  const visual: StatusVisual = SEVERITY_VISUALS[severity];
  const Icon = visual.icon;
  return (
    <span className={[styles.marker, styles[`tone-${visual.tone}`], className].join(" ").trim()}>
      <Icon />
      {visual.label}
    </span>
  );
}
