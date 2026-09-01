import { PRODUCT_DISCLAIMER, PRODUCT_NAME } from "@/lib/constants";
import { getFixtureAuditRun, getFixturePortalAssessments } from "@/lib/publishedFixtures";
import { OverviewContent } from "@/components/overview/OverviewContent";
import styles from "./overview.module.css";

/**
 * Session 12 ("Assam overview") — implementation.md section 14. Lets a
 * first-time visitor answer "what was audited, when, the major result, and
 * where to investigate next" (this session's exit criterion) without
 * leaving this page. Every number below is derived from the same validated
 * `data/fixtures/*.json` records the build already loads — nothing here is
 * invented, and per implementation.md section 10.2 there is deliberately
 * no composite score, vanity chart, or ranking.
 *
 * The audit date/coverage/status/methodology-and-download links already
 * live in the persistent `AuditContextBanner` (root layout, Session 11) —
 * this page does not re-derive that summary, per DESIGN.md's "Do" list.
 * The section content itself lives in `OverviewContent` so it can be
 * exercised directly in tests against synthetic (including empty)
 * assessment data — see `OverviewContent.test.tsx`.
 */
export default function HomePage() {
  const auditRun = getFixtureAuditRun();
  const assessments = getFixturePortalAssessments();

  return (
    <main id="main-content">
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>{PRODUCT_NAME}</h1>
          <p>{PRODUCT_DISCLAIMER}</p>
          <p>
            This case study observed {auditRun.portalCount} Assam government web portal
            {auditRun.portalCount === 1 ? "" : "s"} and checked each one for basic technical health
            — whether it is reachable, whether it uses HTTPS correctly, and whether its links work —
            plus signals a human reviewer can use to judge staleness, directory accuracy, and
            possible overlap between portals. It does not rank departments, and it never combines
            these separate checks into one blended number.
          </p>
        </div>

        <OverviewContent auditRun={auditRun} assessments={assessments} />
      </div>
    </main>
  );
}
