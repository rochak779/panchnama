"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExperienceTheme, TaskOutcome } from "@panchnama/schema";
// Imported from the `./constants` subpath, not the package's default `.`
// entry point — see `apps/web/src/lib/experienceOptions.ts` for why: the
// default entry pulls in the Postgres driver and `node:fs`/`node:path`,
// which breaks a client bundle. `./constants` is a plain, side-effect-free
// values module, so this stays client-bundle-safe.
import { MINIMUM_DISPLAY_THRESHOLD } from "@panchnama/database/constants";
import { EXPERIENCE_THEME_LABELS, TASK_OUTCOME_LABELS } from "@/lib/experienceLabels";
import { MODERATION_DISCLAIMER_COPY, REMOVAL_CONTACT_COPY } from "@/lib/experienceCopy";
import { fetchPortalExperiences, type FetchExperiencesResult } from "@/lib/experienceApiClient";
import { formatAuditDate } from "@/lib/formatDate";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import styles from "./ExperienceSection.module.css";

export interface ExperienceSectionProps {
  portalId: string;
  portalName: string;
}

const TOP_THEME_COUNT = 5;

function shareLink(portalId: string): string {
  return `/portals/${portalId}/share-experience`;
}

/**
 * Sorts `summary.themeCounts` descending by count and returns the top few
 * (implementation.md section 10.6: "the most frequent 3-5 themes").
 * Ignores any key that doesn't resolve to a known label rather than
 * rendering a raw enum value.
 */
function topThemes(
  themeCounts: Partial<Record<ExperienceTheme, number>>,
): { theme: ExperienceTheme; count: number }[] {
  return (Object.entries(themeCounts) as [ExperienceTheme, number][])
    .filter(([theme]) => theme in EXPERIENCE_THEME_LABELS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_THEME_COUNT)
    .map(([theme, count]) => ({ theme, count }));
}

/**
 * Session 15 Task 3 (implementation.md section 10.6). Public-facing,
 * moderated citizen-experience summary and list for one portal, rendered
 * below the technical-audit findings on the portal detail page.
 *
 * This component never reads or writes `technicalHealth`, `severity`,
 * `suggestedAction`, or any other audit-pipeline field, and its markup and
 * styling are deliberately distinct from the findings section above it —
 * citizen experiences are moderated, unverified, first-person accounts,
 * never blended into or presented as audit evidence.
 */
export function ExperienceSection({ portalId, portalName }: ExperienceSectionProps) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<FetchExperiencesResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPortalExperiences(portalId, { page }).then((res) => {
      if (cancelled) return;
      setResult(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [portalId, page]);

  const shareEntryPoint = (
    <Link href={shareLink(portalId)} className={styles.shareLink}>
      Share your experience with {portalName}
    </Link>
  );

  return (
    <section className={styles.section} aria-labelledby="experience-heading">
      <hr className={styles.divider} />
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <h2 id="experience-heading" className={styles.heading}>
            Citizen experiences
          </h2>
          {shareEntryPoint}
        </div>

        {loading ? (
          <p role="status" aria-live="polite" className={styles.loading}>
            Loading citizen experiences…
          </p>
        ) : result && result.ok ? (
          result.total === 0 ? (
            <EmptyState
              title="No experiences have been shared for this portal yet"
              description="Be the first to share what happened when you used this portal. Your submission is moderated before anything is published."
              action={
                <Link href={shareLink(portalId)} className={styles.shareLink}>
                  Share your experience
                </Link>
              }
            />
          ) : (
            <PopulatedExperiences
              portalId={portalId}
              result={result}
              page={page}
              onPageChange={setPage}
            />
          )
        ) : result && !result.ok ? (
          <ErrorState
            title="Citizen experiences are unavailable right now"
            description={result.message}
          />
        ) : null}
      </div>
    </section>
  );
}

interface PopulatedExperiencesProps {
  portalId: string;
  result: Extract<FetchExperiencesResult, { ok: true }>;
  page: number;
  onPageChange: (page: number) => void;
}

function PopulatedExperiences({ portalId, result, page, onPageChange }: PopulatedExperiencesProps) {
  const { summary, items, total, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const themes = topThemes(summary.themeCounts);
  const showRating = !summary.minimumDisplayThresholdApplied && summary.averageRating !== undefined;

  return (
    <>
      <div className={styles.summary}>
        <p>
          {summary.approvedExperienceCount}{" "}
          {summary.approvedExperienceCount === 1 ? "experience has" : "experiences have"} been
          shared for this portal
          {summary.earliestExperienceDate && summary.latestExperienceDate
            ? ` between ${formatAuditDate(summary.earliestExperienceDate)} and ${formatAuditDate(
                summary.latestExperienceDate,
              )}`
            : ""}
          .
        </p>

        <div className={styles.summaryBlock}>
          <h3 className={styles.summaryHeading}>Outcomes reported</h3>
          <ul className={styles.countList}>
            {(Object.keys(TASK_OUTCOME_LABELS) as TaskOutcome[]).map((outcome) => (
              <li key={outcome}>
                {TASK_OUTCOME_LABELS[outcome]}: {summary.outcomeCounts[outcome]}
              </li>
            ))}
          </ul>
        </div>

        {themes.length > 0 ? (
          <div className={styles.summaryBlock}>
            <h3 className={styles.summaryHeading}>Most frequently reported themes</h3>
            <ul className={styles.countList}>
              {themes.map(({ theme, count }) => (
                <li key={theme}>
                  {EXPERIENCE_THEME_LABELS[theme]}: {count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {showRating ? (
          <p>
            Average rating {summary.averageRating!.toFixed(1)} of 5, based on {summary.ratingCount}{" "}
            {summary.ratingCount === 1 ? "rating" : "ratings"}.
          </p>
        ) : (
          <p>
            A rating is not shown yet because too few people have rated this portal — an average
            is only published once at least {MINIMUM_DISPLAY_THRESHOLD} ratings have been
            collected.
          </p>
        )}
      </div>

      <div className={styles.disclaimer}>
        <p>{MODERATION_DISCLAIMER_COPY}</p>
      </div>

      <ul className={styles.experienceList}>
        {items.map((item) => (
          <li key={item.submissionId} className={styles.experienceItem}>
            <div className={styles.experienceItemHeader}>
              <span className={styles.experienceOutcome}>
                {TASK_OUTCOME_LABELS[item.outcome as TaskOutcome] ?? item.outcome}
              </span>
              {item.occurredOn ? (
                <span className={styles.experienceDate}>{item.occurredOn}</span>
              ) : null}
            </div>
            {item.themes.length > 0 ? (
              <ul className={styles.themeTagList}>
                {item.themes.map((theme) => (
                  <li key={theme} className={styles.themeTag}>
                    {EXPERIENCE_THEME_LABELS[theme as ExperienceTheme] ?? theme}
                  </li>
                ))}
              </ul>
            ) : null}
            {item.publicText ? <p className={styles.experienceText}>{item.publicText}</p> : null}
            {item.experienceRating !== null ? (
              <p className={styles.experienceRating}>Rated {item.experienceRating} of 5</p>
            ) : null}
          </li>
        ))}
      </ul>

      <nav className={styles.pagination} aria-label="Citizen experience pages">
        <button
          type="button"
          className={styles.paginationButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={`Previous page, page ${Math.max(page - 1, 1)} of ${totalPages}`}
        >
          Previous
        </button>
        <span className={styles.paginationStatus}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className={styles.paginationButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={`Next page, page ${Math.min(page + 1, totalPages)} of ${totalPages}`}
        >
          Next
        </button>
      </nav>

      <p className={styles.removalContact}>{REMOVAL_CONTACT_COPY}</p>

      <Link href={shareLink(portalId)} className={styles.shareLink}>
        Share your experience
      </Link>
    </>
  );
}
