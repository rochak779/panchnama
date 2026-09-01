/**
 * Small shared JSON-response helpers. Every response body here is a fixed,
 * generic shape — never interpolates request-supplied free text, an
 * internal error's raw `.message`, a submission id, or an abuse-key/rate-
 * limit detail (implementation.md section 9.6: "do not expose moderation
 * or abuse signals"; section 9.8: "scrub framework error reporting so
 * free text cannot reach telemetry").
 */
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** implementation.md section 9.6's exact suggested confirmation text. */
export const SUBMISSION_CONFIRMATION_MESSAGE =
  "Thank you. Your experience has been submitted for review. Panchnama is an independent research prototype and cannot resolve or forward individual service complaints.";

export function submissionAcceptedResponse(): Response {
  return jsonResponse({ status: "pending", message: SUBMISSION_CONFIRMATION_MESSAGE }, 201);
}

export function invalidRequestResponse(
  message: string,
  fieldErrors?: Record<string, string[]>,
): Response {
  const body: Record<string, unknown> = { status: "invalid", message };
  if (fieldErrors) body.fieldErrors = fieldErrors;
  return jsonResponse(body, 400);
}

export function forbiddenResponse(message: string): Response {
  return jsonResponse({ status: "forbidden", message }, 403);
}

export function tooLargeResponse(message: string): Response {
  return jsonResponse({ status: "invalid", message }, 413);
}

export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return jsonResponse(
    {
      status: "rate_limited",
      message: "Too many submissions from this network recently. Please try again later.",
      retryAfterSeconds,
    },
    429,
  );
}

export function serviceUnavailableResponse(message: string): Response {
  return jsonResponse({ status: "unavailable", message }, 503);
}
