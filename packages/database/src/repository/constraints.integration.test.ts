import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getTestDbAvailability,
  getTestDb,
  truncateExperienceTables,
  closeTestDb,
} from "../testSupport/testDb.js";

const dbAvailable = await getTestDbAvailability();

afterAll(async () => {
  await closeTestDb();
});

/** These tests insert raw SQL (not through the repository layer, which
 * would refuse invalid input before it ever reaches Postgres) specifically
 * to prove the CHECK constraints reject bad data at the database level
 * too, not only via Zod. */
describe.skipIf(!dbAvailable)("database CHECK constraints", () => {
  beforeEach(async () => {
    await truncateExperienceTables();
  });

  async function insertBaseSubmission(overrides: Record<string, string>): Promise<void> {
    const { client } = getTestDb();
    const columns = {
      portal_id: "'portal-agri-assam'",
      task_type: "'general_information'",
      outcome: "'completed'",
      consent_to_publish: "true",
      source: "'public_form'",
      ...overrides,
    };
    const columnNames = Object.keys(columns).join(", ");
    const values = Object.values(columns).join(", ");
    await client.unsafe(`INSERT INTO experience_submissions (${columnNames}) VALUES (${values})`);
  }

  it("rejects an invalid outcome value", async () => {
    await expect(insertBaseSubmission({ outcome: "'not_a_real_outcome'" })).rejects.toThrow();
  });

  it("rejects an invalid device_type value", async () => {
    await expect(insertBaseSubmission({ device_type: "'spaceship'" })).rejects.toThrow();
  });

  it("rejects an invalid source value", async () => {
    await expect(insertBaseSubmission({ source: "'carrier_pigeon'" })).rejects.toThrow();
  });

  it("rejects an experience_rating outside 1-5", async () => {
    await expect(insertBaseSubmission({ experience_rating: "6" })).rejects.toThrow();
    await expect(insertBaseSubmission({ experience_rating: "0" })).rejects.toThrow();
  });

  it("rejects a themes array containing an unknown theme value", async () => {
    await expect(
      insertBaseSubmission({ themes: "ARRAY['not_a_real_theme']::text[]" }),
    ).rejects.toThrow();
  });

  it("accepts a themes array containing only known theme values", async () => {
    await expect(
      insertBaseSubmission({ themes: "ARRAY['navigation','support']::text[]" }),
    ).resolves.not.toThrow();
  });

  it("rejects a task_description longer than 280 characters at the column-length level", async () => {
    const tooLong = "a".repeat(281);
    await expect(insertBaseSubmission({ task_description: `'${tooLong}'` })).rejects.toThrow();
  });

  it("rejects a free_text longer than 1000 characters at the column-length level", async () => {
    const tooLong = "a".repeat(1001);
    await expect(insertBaseSubmission({ free_text: `'${tooLong}'` })).rejects.toThrow();
  });

  it("rejects an invalid experience_moderation.status value", async () => {
    const { client } = getTestDb();
    const rows = await client.unsafe(
      `INSERT INTO experience_submissions (portal_id, task_type, outcome, consent_to_publish, source)
       VALUES ('portal-agri-assam', 'general_information', 'completed', true, 'public_form')
       RETURNING id`,
    );
    const id = (rows as unknown as { id: string }[])[0]?.id;
    await expect(
      client.unsafe(
        `INSERT INTO experience_moderation (submission_id, status) VALUES ('${id}', 'not_a_real_status')`,
      ),
    ).rejects.toThrow();
  });
});
