import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { experienceAbuseKeys } from "../schema/abuseKeys.js";
import {
  getTestDbAvailability,
  getTestDb,
  truncateExperienceTables,
  closeTestDb,
} from "../testSupport/testDb.js";
import { countEventsInWindow, deleteExpiredAbuseKeys, recordAbuseKeyEvent } from "./abuseKeys.js";

const PORTAL_A = "portal-agri-assam";
const PORTAL_B = "portal-agri-farmers-welfare";
const HASH = "deadbeef".repeat(8); // 64 hex chars, shape of a real HMAC-SHA256 hex digest

const dbAvailable = await getTestDbAvailability();

afterAll(async () => {
  await closeTestDb();
});

describe.skipIf(!dbAvailable)("abuse key events", () => {
  beforeEach(async () => {
    await truncateExperienceTables();
  });

  it("recordAbuseKeyEvent stores no raw IP — only the keyed hash and portalId", async () => {
    const { db } = getTestDb();
    await recordAbuseKeyEvent(db, { keyedHash: HASH, portalId: PORTAL_A, ttlHours: 24 });
    const rows = await db.select().from(experienceAbuseKeys);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.keyedHash).toBe(HASH);
    expect(Object.keys(rows[0] ?? {})).not.toContain("ip");
  });

  it("countEventsInWindow counts only events within the rolling window, scoped by keyedHash", async () => {
    const { db } = getTestDb();
    const now = new Date("2026-08-31T12:00:00.000Z");

    async function insertAt(hash: string, portalId: string, createdAt: Date) {
      await db.insert(experienceAbuseKeys).values({
        keyedHash: hash,
        portalId,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
      });
    }

    // Inside the 24h window (23h59m before `now`).
    await insertAt(HASH, PORTAL_A, new Date(now.getTime() - (24 * 60 - 1) * 60 * 1000));
    // Outside the 24h window (24h + 1s before `now`) — proves a true
    // rolling window, not a calendar-day bucket.
    await insertAt(HASH, PORTAL_A, new Date(now.getTime() - (24 * 60 * 60 + 1) * 1000));
    // A different keyed hash must never contribute to this hash's count.
    await insertAt("a-different-hash".padEnd(64, "0"), PORTAL_A, now);

    const count = await countEventsInWindow(db, { keyedHash: HASH, sinceHours: 24, now });
    expect(count).toBe(1);
  });

  it("scopes correctly to one portal when portalId is supplied, but not otherwise", async () => {
    const { db } = getTestDb();
    const now = new Date("2026-08-31T12:00:00.000Z");
    await recordAbuseKeyEvent(db, { keyedHash: HASH, portalId: PORTAL_A, ttlHours: 24 });
    await recordAbuseKeyEvent(db, { keyedHash: HASH, portalId: PORTAL_B, ttlHours: 24 });

    const global = await countEventsInWindow(db, { keyedHash: HASH, sinceHours: 24, now });
    expect(global).toBe(2);

    const scoped = await countEventsInWindow(db, {
      keyedHash: HASH,
      portalId: PORTAL_A,
      sinceHours: 24,
      now,
    });
    expect(scoped).toBe(1);
  });

  it("supports a fractional sinceHours for the 10-minute duplicate-detection window", async () => {
    const { db } = getTestDb();
    const now = new Date("2026-08-31T12:00:00.000Z");
    await db.insert(experienceAbuseKeys).values({
      keyedHash: HASH,
      portalId: PORTAL_A,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 minutes ago
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });

    const withinTenMinutes = await countEventsInWindow(db, {
      keyedHash: HASH,
      portalId: PORTAL_A,
      sinceHours: 10 / 60,
      now,
    });
    expect(withinTenMinutes).toBe(1);

    const withinOneMinute = await countEventsInWindow(db, {
      keyedHash: HASH,
      portalId: PORTAL_A,
      sinceHours: 1 / 60,
      now,
    });
    expect(withinOneMinute).toBe(0);
  });

  it("deleteExpiredAbuseKeys removes only rows past their expiresAt", async () => {
    const { db } = getTestDb();
    const now = new Date("2026-08-31T12:00:00.000Z");
    await db.insert(experienceAbuseKeys).values([
      {
        keyedHash: HASH,
        portalId: PORTAL_A,
        createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        expiresAt: new Date(now.getTime() - 60 * 60 * 1000), // expired 1h ago
      },
      {
        keyedHash: HASH,
        portalId: PORTAL_A,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 23 * 60 * 60 * 1000), // still valid
      },
    ]);

    const deletedCount = await deleteExpiredAbuseKeys(db, now);
    expect(deletedCount).toBe(1);

    const remaining = await db.select().from(experienceAbuseKeys);
    expect(remaining).toHaveLength(1);
  });
});
