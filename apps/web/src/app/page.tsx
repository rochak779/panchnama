import { PRODUCT_NAME } from "@/lib/constants";
import { getPublishedPortalAssessments } from "@/lib/publishedRun";
import { OverviewContent } from "@/components/overview/OverviewContent";
import styles from "./overview.module.css";

/**
 * Session 12 ("Assam overview") — implementation.md section 14. Lets a
 * first-time visitor go straight to the findings: what was audited, the
 * major results, and where to investigate next. Every number below is
 * derived from the same validated real published-data records the build
 * already loads — nothing here is invented, and per implementation.md
 * section 10.2 there is deliberately no composite score, vanity chart, or
 * ranking.
 *
 * The independence disclaimer and "what this audit did" framing text
 * that used to open this page (Session 12's original hero) — moved to
 * `/about` (a later split) so a first-time visitor lands on results
 * immediately; that context is one click away, next to Methodology in
 * the header nav, for whoever wants it. No explanatory hero copy remains
 * here at all (a later trim) — just the product name; the audit
 * date/coverage and methodology/download links already live in the
 * persistent `AuditContextBanner` (root layout, Session 11) — this page
 * does not re-derive that summary, per DESIGN.md's "Do" list. The section
 * content itself lives in `OverviewContent` so it can be exercised
 * directly in tests against synthetic (including empty) assessment data —
 * see `OverviewContent.test.tsx`.
 */
export default function HomePage() {
  const assessments = getPublishedPortalAssessments();

  return (
    <main id="main-content">
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>{PRODUCT_NAME}</h1>
        </div>

        <OverviewContent assessments={assessments} />
      </div>
    </main>
  );
}
