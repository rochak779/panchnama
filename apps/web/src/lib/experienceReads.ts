import { getApprovedExperiences, getPortalExperienceSummary, type Db } from "@panchnama/database";
import { jsonResponse, serviceUnavailableResponse } from "./apiResponses";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export interface ReadExperiencesDeps {
  db: Db | undefined;
}

/**
 * `GET /api/portals/:portalId/experiences` core logic, injectable for
 * tests. Delegates entirely to `packages/database`'s
 * `getApprovedExperiences`/`getPortalExperienceSummary`, which already
 * enforce implementation.md section 5.14's publication gate
 * (`consentToPublish && status === "approved"`) at the SQL `WHERE` clause
 * — this function does not, and must not, add any alternate path that
 * could return a pending/rejected/non-consenting submission (e.g. no
 * "include unapproved" query parameter is ever read here, regardless of
 * what a caller passes).
 */
export async function handleReadPortalExperiences(
  request: Request,
  portalId: string,
  deps: ReadExperiencesDeps,
): Promise<Response> {
  const db = deps.db;
  if (!db) {
    return serviceUnavailableResponse(
      "Experience reads are temporarily unavailable. Please try again later.",
    );
  }

  const url = new URL(request.url);
  const page = clampPage(url.searchParams.get("page"));
  const pageSize = clampPageSize(url.searchParams.get("pageSize"));

  try {
    const [reads, summary] = await Promise.all([
      getApprovedExperiences(db, portalId, { page, pageSize }),
      getPortalExperienceSummary(db, portalId),
    ]);

    return jsonResponse(
      {
        portalId,
        page: reads.page,
        pageSize: reads.pageSize,
        total: reads.total,
        items: reads.items,
        summary,
      },
      200,
    );
  } catch {
    // See experienceSubmission.ts's catch block doc comment: any error
    // reaching here came from a database call and is treated as the
    // database being unavailable, never rethrown or logged with raw
    // detail.
    return serviceUnavailableResponse(
      "Experience reads are temporarily unavailable. Please try again later.",
    );
  }
}

function clampPage(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function clampPageSize(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}
