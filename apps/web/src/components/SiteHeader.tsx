import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/constants";
import styles from "./layout.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/inventory", label: "Inventory" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
] as const;

/**
 * Site header: an independent wordmark (plain text — no emblem, seal, or
 * imagery that could read as a government mark, per implementation.md
 * section 10.10), plus primary navigation. The independence disclaimer
 * itself lives on `/about` and in the footer (`IndependenceNotice`), not
 * repeated inline here as a header tag. `<header>`/`<nav>` landmarks are
 * semantic, not decorative, so screen-reader users can jump straight to
 * navigation (section 10.9).
 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.wordmarkGroup}>
          <Link href="/" className={styles.wordmark}>
            {PRODUCT_NAME}
          </Link>
        </div>
        <nav aria-label="Primary">
          <ul className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
