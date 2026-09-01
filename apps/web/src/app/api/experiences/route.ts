import { getAbuseKeySecret } from "@/lib/abuseKeySecret";
import { serviceUnavailableResponse } from "@/lib/apiResponses";
import { getDb } from "@/lib/db";
import { handleSubmitExperience } from "@/lib/experienceSubmission";

/** Node.js runtime required — `@panchnama/database` uses postgres.js's raw
 * TCP driver, which the Edge runtime does not support (see
 * `packages/database/src/client.ts`'s doc comment). */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let abuseKeySecret: string;
  try {
    abuseKeySecret = getAbuseKeySecret();
  } catch {
    // Missing server configuration is treated the same as a database
    // outage from the client's point of view: a clean, generic
    // unavailability response, never a crash and never an echoed error
    // message (the underlying error carries no request data, but this
    // route still never forwards raw error text to a client — matching
    // section 9.8's "scrub framework error reporting" discipline).
    return serviceUnavailableResponse(
      "Experience submissions are temporarily unavailable. Please try again later.",
    );
  }

  return handleSubmitExperience(request, { db: getDb(), abuseKeySecret });
}
