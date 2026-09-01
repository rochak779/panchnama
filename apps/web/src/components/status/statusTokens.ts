import type { ComponentType } from "react";
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  HelpCircleIcon,
  InfoIcon,
  XCircleIcon,
} from "../icons";

/**
 * Single source of truth mapping each domain status enum
 * (`@panchnama/schema`'s `TechnicalHealth`/`Severity`) to a tone (a design
 * token, not a raw color), a label, and an icon. implementation.md section
 * 10.9: "Do not communicate status by color alone" — every consumer
 * (StatusBadge, SeverityMarker) renders the icon and the label together,
 * every time; color is a reinforcing signal on top of two other channels
 * (shape + text), never the only one. Kept independent of
 * `@panchnama/schema`'s literal union types (string keys here) rather than
 * importing them, so this UI-only module has no dependency on the schema
 * package's build output for a Session 12+ concern; the exhaustiveness of
 * each Record below is what actually keeps it correct.
 */

export type StatusTone = "good" | "caution" | "severe" | "info" | "unknown";

export interface StatusVisual {
  label: string;
  tone: StatusTone;
  icon: ComponentType<{ className?: string }>;
}

export const TECHNICAL_HEALTH_VISUALS: Record<
  "healthy" | "degraded" | "unavailable" | "not_assessable",
  StatusVisual
> = {
  healthy: { label: "Healthy", tone: "good", icon: CheckCircleIcon },
  degraded: { label: "Degraded", tone: "caution", icon: AlertTriangleIcon },
  unavailable: { label: "Unavailable", tone: "severe", icon: XCircleIcon },
  not_assessable: { label: "Not assessable", tone: "unknown", icon: HelpCircleIcon },
};

export const SEVERITY_VISUALS: Record<"critical" | "significant" | "advisory", StatusVisual> = {
  critical: { label: "Critical", tone: "severe", icon: AlertOctagonIcon },
  significant: { label: "Significant", tone: "caution", icon: AlertTriangleIcon },
  advisory: { label: "Advisory", tone: "info", icon: InfoIcon },
};

export const SUGGESTED_ACTION_VISUALS: Record<
  "maintain" | "repair" | "review_consolidation" | "review_retirement" | "manual_assessment",
  StatusVisual
> = {
  maintain: { label: "Maintain", tone: "good", icon: CheckCircleIcon },
  repair: { label: "Repair", tone: "caution", icon: AlertTriangleIcon },
  review_consolidation: { label: "Review: possible consolidation", tone: "info", icon: InfoIcon },
  review_retirement: { label: "Review: possible retirement", tone: "info", icon: InfoIcon },
  manual_assessment: { label: "Needs manual assessment", tone: "unknown", icon: HelpCircleIcon },
};
