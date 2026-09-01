import { PRODUCT_DISCLAIMER, PRODUCT_NAME } from "@/lib/constants";
import { getFixturePortalAssessments } from "@/lib/publishedFixtures";
import { EvidenceCallout } from "@/components/EvidenceCallout";
import { StatusBadge } from "@/components/status/StatusBadge";
import styles from "./page.module.css";

/**
 * Session 11 scope note: this is the design-system foundation, not the
 * real Assam overview page. implementation.md section 14 assigns the full
 * overview information architecture (hero proposition, coverage summary,
 * priority findings, directory mismatch summary, limitations callout) to
 * Session 12. This page exists to prove the mechanism end to end — real
 * layout, real components, real (fixture) data, a real static build —
 * without building content that belongs to a later session.
 */
export default function HomePage() {
  const assessments = getFixturePortalAssessments();

  return (
    <main id="main-content">
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>{PRODUCT_NAME}</h1>
          <p>{PRODUCT_DISCLAIMER}</p>
        </div>

        <section className={styles.section} aria-labelledby="portals-heading">
          <h2 id="portals-heading">Portals in the observed estate</h2>
          <ul className={styles.portalGrid}>
            {assessments.map((assessment) => (
              <li key={assessment.portal.id} className={styles.portalCard}>
                <h3>
                  <a href={assessment.portal.canonicalUrl}>{assessment.portal.name}</a>
                </h3>
                {assessment.portal.department ? (
                  <p className={styles.portalDept}>{assessment.portal.department}</p>
                ) : null}
                <StatusBadge status={assessment.technicalHealth} />
              </li>
            ))}
          </ul>
        </section>

        <EvidenceCallout
          heading="About this build"
          meta={<span>data/fixtures/portal-assessments.json — Session 11</span>}
        >
          The portals above are loaded from validated local fixtures, not a real audit. Real Assam
          inventory, crawl, and review data does not exist in this repository yet (Session 17+).
        </EvidenceCallout>

        <p className={styles.placeholderNote}>
          The full Assam overview (coverage summary, priority findings, directory mismatch summary),
          website inventory, portal detail pages, and methodology are built in Sessions 12–16 — see{" "}
          <code>implementation.md</code> section 14.
        </p>
      </div>
    </main>
  );
}
