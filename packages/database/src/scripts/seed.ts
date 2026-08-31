import { like } from "drizzle-orm";
import { loadEnv, requireDatabaseUrl } from "../env.js";
import { createDbClient } from "../client.js";
import { SEED_TAG_PREFIX } from "../constants.js";
import { experienceSubmissions } from "../schema/submissions.js";
import { createPendingSubmission } from "../repository/submissions.js";
import { recordModerationDecision } from "../repository/moderation.js";
import { isFixturePortalId } from "../fixtures/portals.js";
import { SEED_SUBMISSIONS } from "../fixtures/seedData.js";

/**
 * `pnpm db:seed` — idempotent by construction: it always deletes every row
 * whose `seed_key` starts with `SEED_TAG_PREFIX` (cascading to their
 * moderation rows) before reinserting the fixed `SEED_SUBMISSIONS` list.
 * Running it twice produces the same rows both times rather than
 * duplicates, and never touches rows without a matching `seed_key` (i.e.
 * real submissions, or another test's data).
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const databaseUrl = requireDatabaseUrl(env);
  const { db, close } = createDbClient(databaseUrl);

  try {
    const deleted = await db
      .delete(experienceSubmissions)
      .where(like(experienceSubmissions.seedKey, `${SEED_TAG_PREFIX}-%`))
      .returning({ id: experienceSubmissions.id });
    console.info(`Removed ${deleted.length} existing seed row(s).`);

    let created = 0;
    for (const seed of SEED_SUBMISSIONS) {
      const submission = await createPendingSubmission(
        db,
        { ...seed.input, seedKey: seed.seedKey },
        isFixturePortalId,
      );
      if (seed.decision) {
        await recordModerationDecision(db, {
          submissionId: submission.id,
          decision: seed.decision.decision,
          ...(seed.decision.reasonCode ? { reasonCode: seed.decision.reasonCode } : {}),
          ...(seed.decision.publicText ? { publicText: seed.decision.publicText } : {}),
        });
      }
      created += 1;
    }
    console.info(`Seeded ${created} deterministic submission(s).`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("db:seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
