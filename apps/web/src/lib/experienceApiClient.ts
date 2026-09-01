import type { PortalExperienceSummary } from "@panchnama/schema";
import type { ApprovedExperience } from "@panchnama/database";
import { SUBMISSION_CONFIRMATION_MESSAGE } from "./apiResponses";
import { HONEYPOT_FIELD_NAME, type ExperienceRequestBody } from "./requestSchema";

/**
 * Typed `fetch` wrappers around the experience submission/read API. No UI
 * code lives here — Task 2 (the form) and Task 3 (the approved-experience
 * list) import these functions instead of calling `fetch` themselves.
 */

export type SubmitExperienceResult =
  | { ok: true; message: string }
  | { ok: false; kind: "invalid"; message: string; fieldErrors?: Record<string, string[]> }
  | { ok: false; kind: "rate_limited"; message: string; retryAfterSeconds: number }
  | { ok: false; kind: "unavailable"; message: string }
  | { ok: false; kind: "network"; message: string };

/**
 * `ExperienceRequestBody` minus the fields `submitExperience` already
 * accepts as separate parameters: `portalId` (this function's first
 * argument) and the honeypot field (this function's third argument, always
 * forwarded from the caller's actual DOM field value).
 */
export type SubmitExperiencePayload = Omit<
  ExperienceRequestBody,
  "portalId" | typeof HONEYPOT_FIELD_NAME
>;

const GENERIC_UNAVAILABLE_MESSAGE =
  "Something went wrong submitting your experience. Please try again later.";
const GENERIC_NETWORK_MESSAGE =
  "Could not reach Panchnama. Check your connection and try again.";

/**
 * POSTs a submission to `/api/experiences`. Never throws — every failure
 * mode, including `fetch` itself rejecting (offline, CORS, DNS, etc.), is
 * mapped into `SubmitExperienceResult`'s `network` case instead.
 */
export async function submitExperience(
  portalId: string,
  payload: SubmitExperiencePayload,
  honeypotValue: string,
): Promise<SubmitExperienceResult> {
  let response: Response;
  try {
    response = await fetch("/api/experiences", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        portalId,
        [HONEYPOT_FIELD_NAME]: honeypotValue,
      }),
    });
  } catch {
    return { ok: false, kind: "network", message: GENERIC_NETWORK_MESSAGE };
  }

  let body: Record<string, unknown> | null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (response.status === 201 && body?.status === "pending") {
    const message =
      typeof body.message === "string" ? body.message : SUBMISSION_CONFIRMATION_MESSAGE;
    return { ok: true, message };
  }

  if (body?.status === "invalid") {
    const message = typeof body.message === "string" ? body.message : GENERIC_UNAVAILABLE_MESSAGE;
    const fieldErrors =
      body.fieldErrors && typeof body.fieldErrors === "object"
        ? (body.fieldErrors as Record<string, string[]>)
        : undefined;
    return fieldErrors
      ? { ok: false, kind: "invalid", message, fieldErrors }
      : { ok: false, kind: "invalid", message };
  }

  if (body?.status === "rate_limited") {
    const message = typeof body.message === "string" ? body.message : GENERIC_UNAVAILABLE_MESSAGE;
    const retryAfterSeconds =
      typeof body.retryAfterSeconds === "number" ? body.retryAfterSeconds : 0;
    return { ok: false, kind: "rate_limited", message, retryAfterSeconds };
  }

  if (body?.status === "unavailable") {
    const message = typeof body.message === "string" ? body.message : GENERIC_UNAVAILABLE_MESSAGE;
    return { ok: false, kind: "unavailable", message };
  }

  // Any other status (e.g. 403 forbidden from a misconfigured cross-origin
  // request, 500, or a malformed body) is reported as generically
  // unavailable rather than surfacing raw server detail to the citizen.
  return { ok: false, kind: "unavailable", message: GENERIC_UNAVAILABLE_MESSAGE };
}

export type FetchExperiencesResult =
  | {
      ok: true;
      page: number;
      pageSize: number;
      total: number;
      items: ApprovedExperience[];
      summary: PortalExperienceSummary;
    }
  | { ok: false; kind: "unavailable" | "network"; message: string };

const GENERIC_READ_UNAVAILABLE_MESSAGE =
  "Experiences for this portal are temporarily unavailable. Please try again later.";
const GENERIC_READ_NETWORK_MESSAGE =
  "Could not reach Panchnama. Check your connection and try again.";

/**
 * GETs the approved-experience page and summary for one portal. Never
 * throws — a thrown/rejected `fetch` maps to the `network` kind.
 */
export async function fetchPortalExperiences(
  portalId: string,
  opts: { page?: number } = {},
): Promise<FetchExperiencesResult> {
  const params = new URLSearchParams();
  if (opts.page) params.set("page", String(opts.page));
  const query = params.toString();
  const url = `/api/portals/${encodeURIComponent(portalId)}/experiences${query ? `?${query}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin" });
  } catch {
    return { ok: false, kind: "network", message: GENERIC_READ_NETWORK_MESSAGE };
  }

  let body: Record<string, unknown> | null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (response.status === 200 && body) {
    return {
      ok: true,
      page: body.page as number,
      pageSize: body.pageSize as number,
      total: body.total as number,
      items: body.items as ApprovedExperience[],
      summary: body.summary as PortalExperienceSummary,
    };
  }

  if (response.status === 503) {
    const message =
      typeof body?.message === "string" ? body.message : GENERIC_READ_UNAVAILABLE_MESSAGE;
    return { ok: false, kind: "unavailable", message };
  }

  return { ok: false, kind: "unavailable", message: GENERIC_READ_UNAVAILABLE_MESSAGE };
}
