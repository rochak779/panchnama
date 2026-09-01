import { statSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { formatAuditDate } from "@/lib/formatDate";
import { METHODOLOGY_VERSION_HISTORY } from "@/lib/methodologyContent";
import styles from "./exports.module.css";

export const metadata: Metadata = { title: "Download the audit data" };

/**
 * Session 16, Task 3 — implementation.md section 10.8's public download
 * page and section 10.1's "link to download the dataset" requirement.
 * The five files listed here are the exact set `apps/web/scripts/build-exports.ts`
 * (Task 1) writes into `apps/web/public/exports/`; that script has no
 * exported filename constant of its own, so this list is the second
 * authorized place the five names appear, per the task brief.
 */
const EXPORT_FILES = [
  {
    filename: "audit-summary.json",
    description:
      "One JSON object summarising the whole audit run: geography, dates, run status, " +
      "methodology version, and portal counts by outcome.",
  },
  {
    filename: "portals.json",
    description:
      "Every published portal's identity, status, and finding counts (critical/significant/advisory) " +
      "— no individual finding detail.",
  },
  {
    filename: "findings.json",
    description:
      "Every published finding across all portals, with severity, confidence, review status, and the " +
      "affected URLs.",
  },
  {
    filename: "assam-audit.csv",
    description:
      "A single spreadsheet-ready CSV with one row per portal, flattening the same status and finding " +
      "counts into plain columns.",
  },
  {
    filename: "methodology.json",
    description: "The current methodology version and its full version history, machine-readable.",
  },
] as const;

export interface ExportFileRow {
  filename: string;
  description: string;
  href: string;
  available: boolean;
  sizeLabel?: string;
  lastModifiedLabel?: string;
}

/**
 * Formats a byte count as human-readable kilobytes, one decimal place —
 * this codebase has no existing file-size formatter (checked `apps/web/src/lib/`
 * first, per the task brief), so this is a small local helper rather than
 * a new shared module for a single caller.
 */
function formatFileSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Reads real file stats from `exportsDir` for each of the five expected
 * export files. Pure with respect to its `exportsDir` argument (dependency
 * injectable for tests) so `page.test.tsx` can point it at a temp
 * directory missing one file without touching the real generated output.
 * A missing or unreadable file renders as an "unavailable" row instead of
 * throwing, so one missing export never crashes the whole page/build —
 * the build can legitimately run before `build:exports` in some flows.
 */
export function buildExportFileRows(exportsDir: string): ExportFileRow[] {
  return EXPORT_FILES.map(({ filename, description }) => {
    const href = `/exports/${filename}`;
    try {
      const stats = statSync(join(exportsDir, filename));
      return {
        filename,
        description,
        href,
        available: true,
        sizeLabel: formatFileSize(stats.size),
        lastModifiedLabel: formatAuditDate(stats.mtime.toISOString()),
      };
    } catch {
      return { filename, description, href, available: false };
    }
  });
}

const DEFAULT_EXPORTS_DIR = join(process.cwd(), "public", "exports");

export interface ExportsPageProps {
  /**
   * Test-only override for the directory `buildExportFileRows` reads
   * from. Next.js never supplies this prop in real routing — the default
   * is the real `apps/web/public/exports/` directory `build-exports.ts`
   * writes into.
   */
  exportsDir?: string;
}

export default function ExportsPage({ exportsDir = DEFAULT_EXPORTS_DIR }: ExportsPageProps = {}) {
  const rows = buildExportFileRows(exportsDir);
  const versionHistory = [...METHODOLOGY_VERSION_HISTORY].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return (
    <main id="main-content">
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>Download the audit data</h1>
          <p>
            The full public dataset behind this case study, as plain files. Every file below is
            generated from the same published audit run shown on the rest of this site — nothing
            here is a separate or newer dataset.
          </p>
        </div>

        <section className={styles.section} aria-labelledby="files-heading">
          <h2 id="files-heading">Export files</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Description</th>
                  <th scope="col">Size</th>
                  <th scope="col">Last updated</th>
                  <th scope="col">Download</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.filename}>
                    <td>
                      <code>{row.filename}</code>
                    </td>
                    <td>{row.description}</td>
                    {row.available ? (
                      <>
                        <td>{row.sizeLabel}</td>
                        <td>{row.lastModifiedLabel}</td>
                        <td>
                          <a href={row.href} download className={styles.downloadLink}>
                            Download {row.filename}
                          </a>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>Unavailable</td>
                        <td>Unavailable</td>
                        <td>
                          <span className={styles.unavailable}>
                            Unavailable — this file has not been generated yet.
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="changelog-heading">
          <h2 id="changelog-heading">Methodology changelog</h2>
          <p className={styles.prose}>
            Every dataset above is versioned against the same methodology. See the full{" "}
            <Link href="/methodology">methodology</Link> for what each check means and how findings
            are reviewed before publication.
          </p>
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
      </div>
    </main>
  );
}
