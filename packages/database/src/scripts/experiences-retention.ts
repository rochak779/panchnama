import { loadEnv, requireDatabaseUrl, getRetentionRejectedDays } from "../env.js";
import { createDbClient } from "../client.js";
import { runRetention } from "../repository/retention.js";

/**
 * `pnpm experiences:retention` — deletes rejected submissions older than
 * `EXPERIENCE_RETENTION_REJECTED_DAYS` (default 90) and abuse-key rows past
 * their expiry, per implementation.md section 9.8.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const databaseUrl = requireDatabaseUrl(env);
  const rejectedRetentionDays = getRetentionRejectedDays(env);

  const { db, close } = createDbClient(databaseUrl);
  try {
    const report = await runRetention(db, { rejectedRetentionDays });
    console.info(
      `Retention complete: ${report.rejectedSubmissionsDeleted} rejected submission(s) older than ` +
        `${rejectedRetentionDays} day(s) deleted; ${report.expiredAbuseKeysDeleted} expired abuse-key row(s) deleted.`,
    );
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("experiences:retention failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
