import { getDb } from "@/lib/db";
import { handleReadPortalExperiences } from "@/lib/experienceReads";

/** Node.js runtime required — see `api/experiences/route.ts`'s identical
 * doc comment (`@panchnama/database` uses postgres.js's raw TCP driver). */
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ portalId: string }> },
): Promise<Response> {
  const { portalId } = await params;
  return handleReadPortalExperiences(request, portalId, { db: getDb() });
}
