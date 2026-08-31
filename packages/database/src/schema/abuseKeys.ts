import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * `experience_abuse_keys` — one row per submission *attempt* event, not a
 * single rolling counter column. implementation.md section 9.6 needs to
 * support two rolling windows ("max 5 per 24h across portals, max 2 per
 * portal per 24h"); an event-per-row shape lets a future rate limiter
 * (Session 10) answer both with a `COUNT(*) WHERE keyed_hash = ? AND
 * created_at > now() - interval '24 hours' [AND portal_id = ?]` query,
 * which is correct for a *rolling* window. A single counter column would
 * need a reset boundary (calendar day, fixed window) that section 9.6
 * explicitly warns against ("do not include a calendar-day bucket in the
 * key because that would not enforce a rolling 24-hour limit across
 * midnight").
 *
 * `keyed_hash` must never be a raw IP address (section 5.12, section 9.6).
 * This session only creates the table and basic read/write primitives
 * (`src/repository/abuseKeys.ts`); computing the HMAC from a request IP is
 * Session 10's job, once `EXPERIENCE_ABUSE_KEY_SECRET` has a real consumer.
 *
 * `expires_at` is set at insert time (`created_at + ttl`) rather than
 * computed at query time, so the retention job's delete is a single
 * `WHERE expires_at < now()` with an index behind it.
 */
export const experienceAbuseKeys = pgTable(
  "experience_abuse_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    keyedHash: text("keyed_hash").notNull(),
    portalId: text("portal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index("experience_abuse_keys_hash_created_idx").on(table.keyedHash, table.createdAt),
    index("experience_abuse_keys_hash_portal_created_idx").on(
      table.keyedHash,
      table.portalId,
      table.createdAt,
    ),
    index("experience_abuse_keys_expires_at_idx").on(table.expiresAt),
  ],
);

export type ExperienceAbuseKeyRow = typeof experienceAbuseKeys.$inferSelect;
export type NewExperienceAbuseKeyRow = typeof experienceAbuseKeys.$inferInsert;
