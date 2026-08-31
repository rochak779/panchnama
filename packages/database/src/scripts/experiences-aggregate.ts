import { loadEnv, requireDatabaseUrl } from "../env.js";
import { createDbClient } from "../client.js";
import { getPortalExperienceSummary } from "../repository/reads.js";
import { FIXTURE_PORTAL_IDS } from "../fixtures/portals.js";
import { readFlag } from "./flags.js";

/**
 * `pnpm experiences:aggregate [--portal-id <id>]` — computes and prints a
 * `PortalExperienceSummary`-shaped aggregate for one portal, or every
 * fixture portal id if `--portal-id` is omitted. Print-only this session:
 * there is no consumer yet to persist the result to (Session 10/15), so
 * this proves `getPortalExperienceSummary` is correct without inventing an
 * unread persistence target.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const portalIdFlag = readFlag(argv, "portal-id");
  const portalIds = portalIdFlag ? [portalIdFlag] : [...FIXTURE_PORTAL_IDS];

  const databaseUrl = requireDatabaseUrl(loadEnv());
  const { db, close } = createDbClient(databaseUrl);
  try {
    for (const portalId of portalIds) {
      const summary = await getPortalExperienceSummary(db, portalId);
      console.info(JSON.stringify(summary, null, 2));
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("experiences:aggregate failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
