import { loadEnv } from "@panchnama/database";

/**
 * This is the first session that reads `EXPERIENCE_ABUSE_KEY_SECRET` —
 * `packages/database/src/env.ts` declared it in Session 9 specifically for
 * this session's consumption, documented there as "unused by any code in
 * Session 9." No changes to `packages/database` were needed to read it;
 * `loadEnv()` already validates and returns it.
 */
export class MissingAbuseKeySecretError extends Error {
  constructor() {
    super(
      "EXPERIENCE_ABUSE_KEY_SECRET is not set. Copy .env.example to .env.local and set it to a " +
        "long random value before accepting experience submissions.",
    );
    this.name = "MissingAbuseKeySecretError";
  }
}

export function getAbuseKeySecret(): string {
  const env = loadEnv();
  if (!env.EXPERIENCE_ABUSE_KEY_SECRET) {
    throw new MissingAbuseKeySecretError();
  }
  return env.EXPERIENCE_ABUSE_KEY_SECRET;
}
