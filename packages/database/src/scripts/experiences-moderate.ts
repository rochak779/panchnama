import { loadEnv, requireDatabaseUrl } from "../env.js";
import { createDbClient } from "../client.js";
import { recordModerationDecision, type ModerationDecision } from "../repository/moderation.js";
import { readFlag } from "./flags.js";

const VALID_DECISIONS: readonly ModerationDecision[] = ["approved", "rejected", "needs_redaction"];

function isModerationDecision(value: string): value is ModerationDecision {
  return (VALID_DECISIONS as readonly string[]).includes(value);
}

/**
 * `pnpm experiences:moderate --id <id> --decision <approve|reject|needs_redaction> [--reason <code>] [--public-text <text>]`
 *
 * `approved` without `--public-text` publishes the original `freeText`
 * verbatim; `needs_redaction` requires `--public-text` (enforced in
 * `recordModerationDecision`).
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const id = readFlag(argv, "id");
  const decisionFlag = readFlag(argv, "decision");
  const reason = readFlag(argv, "reason");
  const publicText = readFlag(argv, "public-text");

  if (!id) {
    console.error(
      "Usage: experiences:moderate --id <id> --decision <approved|rejected|needs_redaction>",
    );
    process.exitCode = 1;
    return;
  }
  // Accept both "approve"/"reject" (verb form, matches implementation.md's
  // CLI usage example) and the underlying ExperienceStatus enum values.
  const normalizedDecision =
    decisionFlag === "approve" ? "approved" : decisionFlag === "reject" ? "rejected" : decisionFlag;

  if (!normalizedDecision || !isModerationDecision(normalizedDecision)) {
    console.error("--decision must be one of: approve, reject, needs_redaction");
    process.exitCode = 1;
    return;
  }

  const databaseUrl = requireDatabaseUrl(loadEnv());
  const { db, close } = createDbClient(databaseUrl);
  try {
    await recordModerationDecision(db, {
      submissionId: id,
      decision: normalizedDecision,
      ...(reason ? { reasonCode: reason } : {}),
      ...(publicText ? { publicText } : {}),
    });
    console.info(`Recorded decision "${normalizedDecision}" for submission ${id}.`);
  } catch (error) {
    console.error(
      "experiences:moderate failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("experiences:moderate failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
