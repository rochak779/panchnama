import { and, count, eq } from "drizzle-orm";
import type { PortalExperienceSummary, TaskOutcome, ExperienceTheme } from "@panchnama/schema";
import { MINIMUM_DISPLAY_THRESHOLD, TASK_OUTCOME_VALUES } from "../constants.js";
import { experienceModeration } from "../schema/moderation.js";
import { experienceSubmissions } from "../schema/submissions.js";
import type { Db } from "../client.js";

/** A single publicly-readable experience: redacted `publicText`, never the
 * original `freeText` — the original is not selected by this query at all,
 * not merely omitted after the fact, so a caller reusing this function
 * cannot accidentally leak it downstream. */
export interface ApprovedExperience {
  submissionId: string;
  portalId: string;
  createdAt: string;
  occurredOn: string | null;
  taskType: string;
  taskDescription: string | null;
  outcome: string;
  themes: string[];
  deviceType: string | null;
  experienceRating: number | null;
  publicText: string | null;
  moderationReasonCode: string | null;
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * Fetches approved, consented experiences for a portal — implementation.md
 * section 5.14's publication gate ("cannot be publicly returned unless
 * `consentToPublish` is true and `status` is `approved`"), enforced here as
 * a `WHERE` clause a caller cannot bypass.
 */
export async function getApprovedExperiences(
  db: Db,
  portalId: string,
  options?: { page?: number; pageSize?: number },
): Promise<{ items: ApprovedExperience[]; page: number; pageSize: number; total: number }> {
  const pageSize = Math.min(options?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(options?.page ?? 1, 1);

  const whereClause = and(
    eq(experienceSubmissions.portalId, portalId),
    eq(experienceModeration.status, "approved"),
    eq(experienceSubmissions.consentToPublish, true),
  );

  const [rows, totalRows] = await Promise.all([
    db
      .select({ submission: experienceSubmissions, moderation: experienceModeration })
      .from(experienceSubmissions)
      .innerJoin(
        experienceModeration,
        eq(experienceModeration.submissionId, experienceSubmissions.id),
      )
      .where(whereClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(experienceSubmissions)
      .innerJoin(
        experienceModeration,
        eq(experienceModeration.submissionId, experienceSubmissions.id),
      )
      .where(whereClause),
  ]);

  const items: ApprovedExperience[] = rows.map(({ submission, moderation }) => ({
    submissionId: submission.id,
    portalId: submission.portalId,
    createdAt: submission.createdAt.toISOString(),
    occurredOn: submission.occurredOn,
    taskType: submission.taskType,
    taskDescription: submission.taskDescription,
    outcome: submission.outcome,
    themes: submission.themes,
    deviceType: submission.deviceType,
    experienceRating: submission.experienceRating,
    publicText: moderation.publicText,
    moderationReasonCode: moderation.moderationReasonCode,
  }));

  return { items, page, pageSize, total: totalRows[0]?.value ?? 0 };
}

/**
 * Computes a `PortalExperienceSummary`-shaped aggregate for one portal,
 * excluding pending/rejected/needs_redaction submissions and
 * non-consented ones (implementation.md section 5.14: "Rejected and
 * pending submissions never contribute to public aggregates"). The
 * returned object is shaped to `.parse()` cleanly against
 * `portalExperienceSummarySchema`.
 */
export async function getPortalExperienceSummary(
  db: Db,
  portalId: string,
): Promise<PortalExperienceSummary> {
  const rows = await db
    .select({ submission: experienceSubmissions })
    .from(experienceSubmissions)
    .innerJoin(
      experienceModeration,
      eq(experienceModeration.submissionId, experienceSubmissions.id),
    )
    .where(
      and(
        eq(experienceSubmissions.portalId, portalId),
        eq(experienceModeration.status, "approved"),
        eq(experienceSubmissions.consentToPublish, true),
      ),
    );

  const outcomeCounts: Record<TaskOutcome, number> = {
    completed: 0,
    partially_completed: 0,
    not_completed: 0,
    information_only: 0,
  };
  const themeCounts: Partial<Record<ExperienceTheme, number>> = {};
  let ratingSum = 0;
  let ratingCount = 0;
  let earliest: string | undefined;
  let latest: string | undefined;

  for (const { submission } of rows) {
    const outcome = submission.outcome as TaskOutcome;
    if (TASK_OUTCOME_VALUES.includes(outcome)) {
      outcomeCounts[outcome] += 1;
    }
    for (const theme of submission.themes as ExperienceTheme[]) {
      themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;
    }
    if (submission.experienceRating !== null) {
      ratingSum += submission.experienceRating;
      ratingCount += 1;
    }
    const dateKey = submission.occurredOn ?? submission.createdAt.toISOString();
    if (dateKey) {
      if (!earliest || dateKey < earliest) earliest = dateKey;
      if (!latest || dateKey > latest) latest = dateKey;
    }
  }

  const summary: PortalExperienceSummary = {
    schemaVersion: "1.0.0",
    portalId,
    approvedExperienceCount: rows.length,
    outcomeCounts,
    themeCounts,
    ratingCount,
    minimumDisplayThresholdApplied: rows.length < MINIMUM_DISPLAY_THRESHOLD,
    generatedAt: new Date().toISOString(),
  };

  if (ratingCount > 0) summary.averageRating = Math.round((ratingSum / ratingCount) * 100) / 100;
  if (earliest) summary.earliestExperienceDate = earliest;
  if (latest) summary.latestExperienceDate = latest;

  return summary;
}
