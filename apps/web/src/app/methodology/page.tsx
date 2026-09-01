import type { Metadata } from "next";
import Link from "next/link";
import {
  CHECK_DEFINITIONS,
  CRAWL_BOUNDARIES_NOTE,
  CURRENT_METHODOLOGY_VERSION,
  ETHICAL_DISCLAIMER,
  EVIDENCE_RETENTION_NOTE,
  EXPERIENCE_POLICY_SUMMARY,
  HUMAN_REVIEW_PROCESS,
  INVENTORY_SOURCES_NOTE,
  KNOWN_LIMITATIONS,
  METHODOLOGY_VERSION_HISTORY,
  OBSERVED_ESTATE_RULES,
  SEVERITY_CONFIDENCE_RULES,
} from "@/lib/methodologyContent";
import styles from "./methodology.module.css";

export const metadata: Metadata = { title: "Methodology" };

/**
 * Session 16, Task 2 — implementation.md section 10.7. A static,
 * server-rendered page: every fact below is build-time-known data from
 * `apps/web/src/lib/methodologyContent.ts` (Task 1), which is itself
 * derived from or checked against the real fixture/audit-run data, so this
 * page can never show a fabricated audit claim. `CURRENT_METHODOLOGY_VERSION`
 * is rendered here (never re-typed) so the version shown always matches the
 * single source of truth.
 */
export default function MethodologyPage() {
  const versionHistory = [...METHODOLOGY_VERSION_HISTORY].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return (
    <main id="main-content">
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>Methodology</h1>
          <p>
            How this case study decides what counts as part of the Assam government web estate,
            what it checks, how it judges severity and confidence, and what a human reviews before
            anything is published.
          </p>
          <span className={styles.versionMeta}>
            Methodology version {CURRENT_METHODOLOGY_VERSION}
          </span>
        </div>

        <section className={styles.section} aria-labelledby="observed-estate-heading">
          <h2 id="observed-estate-heading">The observed estate</h2>
          <p className={styles.prose}>{OBSERVED_ESTATE_RULES}</p>
        </section>

        <section className={styles.section} aria-labelledby="inventory-sources-heading">
          <h2 id="inventory-sources-heading">Inventory sources</h2>
          <p className={styles.prose}>{INVENTORY_SOURCES_NOTE}</p>
        </section>

        <section className={styles.section} aria-labelledby="crawl-boundaries-heading">
          <h2 id="crawl-boundaries-heading">Crawl boundaries</h2>
          <p className={styles.prose}>{CRAWL_BOUNDARIES_NOTE}</p>
        </section>

        <section className={styles.section} aria-labelledby="check-definitions-heading">
          <h2 id="check-definitions-heading">What is checked</h2>
          <dl className={styles.definitionList}>
            {CHECK_DEFINITIONS.map((check) => (
              <div key={check.id}>
                <dt>
                  {check.label} (<code>{check.id}</code>)
                </dt>
                <dd>{check.description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="severity-confidence-heading">
          <h2 id="severity-confidence-heading">Severity and confidence</h2>
          <p className={styles.prose}>{SEVERITY_CONFIDENCE_RULES}</p>
        </section>

        <section className={styles.section} aria-labelledby="human-review-heading">
          <h2 id="human-review-heading">Human review process</h2>
          <p className={styles.prose}>{HUMAN_REVIEW_PROCESS}</p>
        </section>

        <section className={styles.section} aria-labelledby="evidence-retention-heading">
          <h2 id="evidence-retention-heading">Evidence retention</h2>
          <p className={styles.prose}>{EVIDENCE_RETENTION_NOTE}</p>
        </section>

        <section className={styles.section} aria-labelledby="known-limitations-heading">
          <h2 id="known-limitations-heading">Known limitations</h2>
          <ul className={styles.plainList}>
            {KNOWN_LIMITATIONS.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="version-history-heading">
          <h2 id="version-history-heading">Methodology version history</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Date</th>
                  <th scope="col">Summary</th>
                </tr>
              </thead>
              <tbody>
                {versionHistory.map((entry) => (
                  <tr key={entry.version}>
                    <td>{entry.version}</td>
                    <td>{entry.date}</td>
                    <td>{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="ethical-disclaimer-heading">
          <h2 id="ethical-disclaimer-heading">Ethical and unofficial-use disclaimer</h2>
          <p className={styles.prose}>{ETHICAL_DISCLAIMER}</p>
        </section>

        <section className={styles.section} aria-labelledby="experience-policy-heading">
          <h2 id="experience-policy-heading">Citizen experience submissions</h2>
          <p className={styles.prose}>{EXPERIENCE_POLICY_SUMMARY}</p>
          <p className={styles.callout}>
            Read the full{" "}
            <Link href="/privacy">privacy and moderation policy</Link> for what is collected, how
            submissions are moderated, retention periods, and how to request removal.
          </p>
        </section>
      </div>
    </main>
  );
}
