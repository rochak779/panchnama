import { and, eq, gte, lt, sql } from "drizzle-orm";
import { experienceAbuseKeys } from "../schema/abuseKeys.js";
import type { Db } from "../client.js";

/**
 * Basic storage primitives for the abuse-key event log. Deliberately does
 * NOT implement the "max 5 per 24h across portals, max 2 per portal per
 * 24h" rate-limit LOGIC (implementation.md section 9.6) — that decision
 * belongs to Session 10, which will call `countEventsInWindow` with its own
 * thresholds. This session only proves the storage shape supports it.
 */

export async function recordAbuseKeyEvent(
  db: Db,
  input: { keyedHash: string; portalId: string; ttlHours: number },
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlHours * 60 * 60 * 1000);
  await db.insert(experienceAbuseKeys).values({
    keyedHash: input.keyedHash,
    portalId: input.portalId,
    createdAt: now,
    expiresAt,
  });
}

/** Counts events for a keyed hash within a rolling window, optionally
 * scoped to one portal. A future rate limiter calls this twice: once
 * without `portalId` (global 24h cap) and once with it (per-portal cap). */
export async function countEventsInWindow(
  db: Db,
  input: { keyedHash: string; portalId?: string; sinceHours: number },
): Promise<number> {
  const since = new Date(Date.now() - input.sinceHours * 60 * 60 * 1000);
  const conditions = [
    eq(experienceAbuseKeys.keyedHash, input.keyedHash),
    gte(experienceAbuseKeys.createdAt, since),
  ];
  if (input.portalId) {
    conditions.push(eq(experienceAbuseKeys.portalId, input.portalId));
  }
  const rows = await db
    .select({ value: sql<number>`count(*)` })
    .from(experienceAbuseKeys)
    .where(and(...conditions));
  return Number(rows[0]?.value ?? 0);
}

/** Deletes abuse-key rows past their `expiresAt`. Used by
 * `experiences:retention`. */
export async function deleteExpiredAbuseKeys(db: Db, now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(experienceAbuseKeys)
    .where(lt(experienceAbuseKeys.expiresAt, now))
    .returning({ id: experienceAbuseKeys.id });
  return deleted.length;
}
