import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";
import { ETHICAL_DISCLAIMER } from "@/lib/methodologyContent";
import { getPublishedAuditRun } from "@/lib/publishedRun";
import styles from "./about.module.css";

export const metadata: Metadata = { title: "About" };

/**
 * The "what is this / who made it / what did it actually do" page —
 * split out of the home page (which used to open with this prose before
 * getting to any findings) so a first-time visitor lands on results, and
 * this context is one click away, next to Methodology, for whoever wants
 * it before or after. `ETHICAL_DISCLAIMER` is the same constant
 * Methodology renders — reused here, not re-typed, so the wording never
 * drifts between the two pages.
 */
export default function AboutPage() {
  const auditRun = getPublishedAuditRun();

  return (
    <main id="main-content">
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>About {PRODUCT_NAME}</h1>
          <p>{ETHICAL_DISCLAIMER}</p>
        </div>

        <section className={styles.section} aria-labelledby="what-we-did-heading">
          <h2 id="what-we-did-heading">What this audit does</h2>
          <p className={styles.prose}>
            Panchnama observed {auditRun.portalCount} Assam government web portal
            {auditRun.portalCount === 1 ? "" : "s"} and checked each one for basic technical health
            — whether it is reachable, whether it uses HTTPS correctly, and whether its links work —
            plus signals a human reviewer can use to judge staleness, directory accuracy, and
            possible overlap between portals. It does not rank departments, and it never combines
            these separate checks into one blended number.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="next-heading">
          <h2 id="next-heading">Where to go from here</h2>
          <nav aria-label="From about" className={styles.entryPoints}>
            <Link className={styles.entryPointLink} href="/">
              See the findings
            </Link>
            <Link className={styles.entryPointLink} href="/methodology">
              Read the full methodology
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
