import { like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getTestDbAvailability,
  getTestDb,
  truncateExperienceTables,
  closeTestDb,
} from "../testSupport/testDb.js";
import { createPendingSubmission } from "./submissions.js";
import { recordModerationDecision } from "./moderation.js";
import { isFixturePortalId } from "../fixtures/portals.js";
import { SEED_SUBMISSIONS } from "../fixtures/seedData.js";
import { SEED_TAG_PREFIX } from "../constants.js";
import { experienceSubmissions } from "../schema/submissions.js";

const dbAvailable = await getTestDbAvailability();

afterAll(async () => {
  await closeTestDb();
});

/** Exercises the exact same delete-then-reinsert logic
 * `src/scripts/seed.ts` uses, against the test database, and asserts
 * running it twice produces the same row count with no duplicates. (The
 * CLI script itself was also run twice manually against the dev database
 * during verification — see docs/session-log.md.) */
async function runSeedOnce(): Promise<void> {
  const { db } = getTestDb();
  await db
    .delete(experienceSubmissions)
    .where(like(experienceSubmissions.seedKey, `${SEED_TAG_PREFIX}-%`));
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
  }
}

describe.skipIf(!dbAvailable)("seed idempotency", () => {
  beforeEach(async () => {
    await truncateExperienceTables();
  });

  it("running the seed logic twice produces the same row count, no duplicates", async () => {
    const { client } = getTestDb();
    await runSeedOnce();
    const afterFirst = await client<
      { count: string }[]
    >`select count(*)::text from experience_submissions`;
    await runSeedOnce();
    const afterSecond = await client<
      { count: string }[]
    >`select count(*)::text from experience_submissions`;

    expect(afterFirst[0]?.count).toBe(String(SEED_SUBMISSIONS.length));
    expect(afterSecond[0]?.count).toBe(String(SEED_SUBMISSIONS.length));
  });
});
