import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";
import { IndependenceNotice } from "./IndependenceNotice";
import styles from "./layout.module.css";

const FOOTER_LINKS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/exports", label: "Download the dataset" },
  { href: "/inventory", label: "Website inventory" },
  { href: "/privacy", label: "Privacy & moderation policy" },
] as const;

/**
 * Site footer. Repeats the independence disclaimer (section 10.1 asks that
 * every page make this "easy to find" — the header states it once at the
 * top, the footer restates it at the natural end-of-page reading point)
 * and links to the methodology, exports, inventory, and privacy/moderation
 * policy pages. `/privacy` here is expected to render (a later session)
 * the content already written in
 * `docs/experience-privacy-and-moderation.md`.
 */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <nav aria-label="Footer">
          <ul className={styles.footerNav}>
            {FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <IndependenceNotice />
        <div className={styles.footerMeta}>
          <span>{PRODUCT_NAME} — an independent audit of the Assam government web estate.</span>
          <span>Every published finding is dated and sourced. See Methodology for details.</span>
        </div>
      </div>
    </footer>
  );
}
