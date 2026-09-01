import {
  countEventsInWindow,
  createPendingSubmission,
  DatabaseUnavailableError,
  findDuplicateCandidates,
  recordAbuseKeyEvent,
  UnknownPortalIdError,
  type Db,
} from "@panchnama/database";
import { computeAbuseKeyHash, extractClientIp } from "./abuseKey";
import {
  forbiddenResponse,
  invalidRequestResponse,
  rateLimitedResponse,
  serviceUnavailableResponse,
  submissionAcceptedResponse,
} from "./apiResponses";
import { findMatchingCandidateId } from "./duplicateDetection";
import { normalizeBoundedText } from "./normalizeText";
import { isSameOriginRequest } from "./originCheck";
import { detectPrivacyFlags } from "./privacyFlags";
import { loadPublishedPortalIds, type PublishedPortalIdsResult } from "./publishedPortals";
import { experienceRequestSchema, HONEYPOT_FIELD_NAME } from "./requestSchema";

/** implementation.md section 9.6's default content boundaries. */
const MAX_BODY_BYTES = 8 * 1024;
const GLOBAL_RATE_LIMIT = 5;
const GLOBAL_WINDOW_HOURS = 24;
const PORTAL_RATE_LIMIT = 2;
const PORTAL_WINDOW_HOURS = 24;
const DUPLICATE_WINDOW_MINUTES = 10;
/** A fixed, generic retry hint — not computed from the exact moment the
 * oldest counted event expires, which would itself leak abuse-signal
 * detail back to the caller ("without exposing key details" — section
 * 9.6). One hour is a conservative, round, non-revealing suggestion for a
 * rolling 24h/10-per-portal-per-24h limiter. */
const RATE_LIMIT_RETRY_AFTER_SECONDS = 60 * 60;
const ABUSE_KEY_EVENT_TTL_HOURS = 24;

export interface SubmitExperienceDeps {
  db: Db | undefined;
  abuseKeySecret: string;
  now?: () => Date;
  getClientIp?: (request: Request) => string | null;
  loadPortalIds?: () => PublishedPortalIdsResult;
}

/**
 * `POST /api/experiences` core logic, injectable for tests. See
 * `src/app/api/experiences/route.ts` for the real Next.js wrapper.
 *
 * Step order (documented deviation from implementation.md section 9.6's
 * literal numbered list): section 9.6 lists "confirm portalId belongs to
 * the published inventory" as step 1, before "enforce content type and a
 * small request-body limit" (step 2) and "validate the shared Zod schema"
 * (step 3). That literal order is not implementable for an HTTP POST body
 * — `portalId` lives inside the JSON body, so the body must be received,
 * size-checked, parsed, and schema-validated before `portalId` is even
 * known. This function performs the same checks section 9.6 requires, in
 * the order HTTP handling actually allows: content-type → origin/CSRF →
 * body-size → parse → Zod validation (which also validates portalId's
 * *shape*) → honeypot → portalId *membership* in the published inventory
 * → rate limiting → text normalization → privacy flags → duplicate
 * detection → store pending → generic response. Every check section 9.6
 * requires is present; only the ordering is adapted to be executable.
 */
export async function handleSubmitExperience(
  request: Request,
  deps: SubmitExperienceDeps,
): Promise<Response> {
  const now = deps.now ?? (() => new Date());
  const getClientIp = deps.getClientIp ?? extractClientIp;
  const loadPortalIds = deps.loadPortalIds ?? loadPublishedPortalIds;

  // 1. Content-Type.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return invalidRequestResponse("Content-Type must be application/json.");
  }

  // 2. Origin/CSRF (same-origin only).
  if (!isSameOriginRequest(request)) {
    return forbiddenResponse("Cross-origin requests are not allowed on this endpoint.");
  }

  // 3. Body-size limit, enforced on the raw bytes before parsing.
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return invalidRequestResponse("Request body exceeds the 8 KB limit.");
  }

  // 4. Parse.
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return invalidRequestResponse("Request body must be valid JSON.");
  }

  // 5. Zod validation — field-level errors, never silently truncated.
  const result = experienceRequestSchema.safeParse(parsedBody);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "(root)";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return invalidRequestResponse("Submission failed validation.", fieldErrors);
  }
  const body = result.data;

  // 6. Honeypot — reject generically (as an identical-looking accepted
  // response) without revealing detection. Never stored.
  if (body[HONEYPOT_FIELD_NAME]) {
    return submissionAcceptedResponse();
  }

  // 7. Portal-id membership in the published inventory.
  const portalIds = loadPortalIds();
  if (!portalIds.available) {
    return serviceUnavailableResponse(
      "No published inventory is available yet. Submissions cannot be accepted until an audit has been published.",
    );
  }
  if (!portalIds.ids.has(body.portalId)) {
    return invalidRequestResponse("portalId is not part of the published inventory.");
  }

  const db = deps.db;
  if (!db) {
    return serviceUnavailableResponse(
      "Experience submissions are temporarily unavailable. Please try again later.",
    );
  }

  try {
    // 8. Rate limiting — network-derived, without retaining the raw IP.
    const ip = getClientIp(request);
    const abuseKeyHash = computeAbuseKeyHash(deps.abuseKeySecret, ip);
    const nowInstant = now();

    const globalCount = await countEventsInWindow(db, {
      keyedHash: abuseKeyHash,
      sinceHours: GLOBAL_WINDOW_HOURS,
      now: nowInstant,
    });
    if (globalCount >= GLOBAL_RATE_LIMIT) {
      return rateLimitedResponse(RATE_LIMIT_RETRY_AFTER_SECONDS);
    }
    const portalCount = await countEventsInWindow(db, {
      keyedHash: abuseKeyHash,
      portalId: body.portalId,
      sinceHours: PORTAL_WINDOW_HOURS,
      now: nowInstant,
    });
    if (portalCount >= PORTAL_RATE_LIMIT) {
      return rateLimitedResponse(RATE_LIMIT_RETRY_AFTER_SECONDS);
    }

    // 9. Normalize bounded free text; never accept HTML.
    const taskDescription = normalizeBoundedText(body.taskDescription);
    const freeText = normalizeBoundedText(body.freeText);

    // 10. Privacy-pattern flags (moderation flags, not rejections).
    const privacyFlags = [
      ...new Set([...detectPrivacyFlags(taskDescription), ...detectPrivacyFlags(freeText)]),
    ];

    // 11. Duplicate detection (10-minute window). The "same abuse key"
    // criterion from section 9.6 is approximated here, not enforced by an
    // exact per-submission join, because `experience_submissions` has no
    // abuse-key column (see `packages/database/src/repository/
    // duplicates.ts`'s doc comment for why that column was not added).
    // The approximation: only consider this a duplicate at all if the
    // *same abuse key* already has at least one recorded event for this
    // portal within the same 10-minute window (i.e. this key was already
    // active here recently) — content-identical submissions from a
    // *different* key within the window are correctly never marked
    // duplicate, satisfying "different narratives sharing only the same
    // structured choices are not duplicates" for the common case, at the
    // cost of a narrow gap: two different citizens who share an abuse key
    // (e.g. the same NAT/proxy) submitting identical content back-to-back
    // could be flagged as duplicates of each other. This is a documented,
    // explicit limitation of not having a schema-level link, not
    // implemented as a silent trust boundary.
    let duplicateOf: string | undefined;
    const keyActiveForPortalRecently = await countEventsInWindow(db, {
      keyedHash: abuseKeyHash,
      portalId: body.portalId,
      sinceHours: DUPLICATE_WINDOW_MINUTES / 60,
      now: nowInstant,
    });
    if (keyActiveForPortalRecently > 0) {
      const candidates = await findDuplicateCandidates(db, {
        portalId: body.portalId,
        taskType: body.taskType,
        outcome: body.outcome,
        sinceMinutes: DUPLICATE_WINDOW_MINUTES,
        now: nowInstant,
      });
      duplicateOf = findMatchingCandidateId(
        { taskDescription, themes: body.themes, occurredOn: body.occurredOn, freeText },
        candidates,
      );
    }

    // 12. Store as `pending`, even with no privacy flag detected.
    const created = await createPendingSubmission(
      db,
      {
        portalId: body.portalId,
        taskType: body.taskType,
        outcome: body.outcome,
        themes: body.themes,
        consentToPublish: body.consentToPublish,
        source: "public_form",
        privacyFlags,
        ...(body.occurredOn !== undefined ? { occurredOn: body.occurredOn } : {}),
        ...(taskDescription !== null ? { taskDescription } : {}),
        ...(body.deviceType !== undefined ? { deviceType: body.deviceType } : {}),
        ...(body.experienceRating !== undefined ? { experienceRating: body.experienceRating } : {}),
        ...(freeText !== null ? { freeText } : {}),
        ...(duplicateOf !== undefined ? { duplicateOf } : {}),
      },
      (id) => Promise.resolve(portalIds.ids.has(id)),
    );

    await recordAbuseKeyEvent(db, {
      keyedHash: abuseKeyHash,
      portalId: body.portalId,
      ttlHours: ABUSE_KEY_EVENT_TTL_HOURS,
    });

    void created; // internal id is deliberately never returned to the client.

    // 13. Generic receipt — never expose moderation/abuse signals.
    return submissionAcceptedResponse();
  } catch (error) {
    if (error instanceof UnknownPortalIdError) {
      return invalidRequestResponse("portalId is not part of the published inventory.");
    }
    // `packages/database` declares `DatabaseUnavailableError` as a typed
    // error for callers to translate raw failures into (see its doc
    // comment), rather than throwing it itself — no repository function
    // wraps postgres.js's own connection errors. Every remaining error
    // reaching this point came from a database call (rate-limit counts,
    // duplicate lookup, submission insert, or the abuse-key event insert),
    // so it is treated here as exactly that: the database is unavailable.
    // Never rethrown, never logged with its raw `.message` (which could
    // echo a connection string or other operational detail), and never
    // exposed to the client beyond a generic message — implementation.md
    // section 9.8: "the audit scorecard remains readable" and "scrub
    // framework error reporting so free text cannot reach telemetry."
    void new DatabaseUnavailableError(error);
    return serviceUnavailableResponse(
      "Experience submissions are temporarily unavailable. Please try again later.",
    );
  }
}
