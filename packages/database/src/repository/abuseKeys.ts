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
 * scoped to one portal. Session 10's rate limiter calls this twice: once
 * without `portalId` (global 24h cap) and once with it (per-portal cap),
 * and also with a fractional `sinceHours` (e.g. 10/60) for its 10-minute
 * duplicate-detection abuse-key gate — this function's rolling-window
 * arithmetic is not hour-granular, so a fractional value is exact, not an
 * approximation.
 *
 * `now` (Session 10 addition, optional, defaults to `new Date()`) lets a
 * caller pin the "current" instant instead of calling `Date.now()`
 * internally, so tests can prove a true rolling window (e.g. an event
 * 24h+1s before `now` does not count, one 23h59m before `now` does) without
 * depending on wall-clock timing. This is a backward-compatible signature
 * change only — every existing call site that omits `now` behaves exactly
 * as before. */
export async function countEventsInWindow(
  db: Db,
  input: { keyedHash: string; portalId?: string; sinceHours: number; now?: Date },
): Promise<number> {
  const since = new Date((input.now ?? new Date()).getTime() - input.sinceHours * 60 * 60 * 1000);
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
