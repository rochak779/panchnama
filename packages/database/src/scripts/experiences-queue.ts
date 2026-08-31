import { loadEnv, requireDatabaseUrl } from "../env.js";
import { createDbClient } from "../client.js";
import { listModerationQueue } from "../repository/moderation.js";

/** `pnpm experiences:queue` — lists pending submissions for a human
 * moderator, oldest first. Never dumps unbounded free text (see
 * `truncateForModerationPreview`'s doc comment). */
async function main(): Promise<void> {
  const databaseUrl = requireDatabaseUrl(loadEnv());
  const { db, close } = createDbClient(databaseUrl);
  try {
    const items = await listModerationQueue(db);
    if (items.length === 0) {
      console.info("Moderation queue is empty.");
      return;
    }
    console.info(`${items.length} submission(s) awaiting moderation:\n`);
    for (const item of items) {
      console.info(
        [
          `id: ${item.submissionId}`,
          `portal: ${item.portalId}`,
          `created: ${item.createdAt}`,
          `task: ${item.taskType} (${item.outcome})`,
          `themes: ${item.themes.join(", ") || "-"}`,
          `consent: ${item.consentToPublish}`,
          `preview: ${item.freeTextPreview ?? "(no free text)"}`,
        ].join(" | "),
      );
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("experiences:queue failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
