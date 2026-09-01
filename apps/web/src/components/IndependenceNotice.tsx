import { PRODUCT_DISCLAIMER } from "@/lib/constants";
import styles from "./layout.module.css";

/**
 * The independent-project disclaimer (implementation.md section 1.6
 * principle 8, section 10.1: "this is an independent case-study
 * prototype" must be easy to find on every page), rendered once here so
 * SiteHeader/AuditContextBanner/SiteFooter share the exact same wording
 * rather than three independently-drifting copies of it.
 */
export function IndependenceNotice({ className }: { className?: string }) {
  return (
    <p className={[styles.independenceNotice, className].join(" ").trim()}>{PRODUCT_DISCLAIMER}</p>
  );
}
