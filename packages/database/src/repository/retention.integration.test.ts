import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getTestDbAvailability,
  getTestDb,
  truncateExperienceTables,
  closeTestDb,
} from "../testSupport/testDb.js";
import { createPendingSubmission, getSubmissionById } from "./submissions.js";
import { recordModerationDecision } from "./moderation.js";
import { runRetention } from "./retention.js";
import { recordAbuseKeyEvent } from "./abuseKeys.js";
import { experienceModeration } from "../schema/moderation.js";
import { eq } from "drizzle-orm";

const dbAvailable = await getTestDbAvailability();
const PORTAL_A = "portal-agri-assam";
const alwaysKnownPortal = () => true;

afterAll(async () => {
  await closeTestDb();
});

describe.skipIf(!dbAvailable)("retention", () => {
  beforeEach(async () => {
    await truncateExperienceTables();
  });

  it("deletes only rejected submissions older than the threshold, and expired abuse keys, leaving everything else", async () => {
    const { db } = getTestDb();

    const oldRejected = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
      },
      alwaysKnownPortal,
    );
    const recentRejected = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
      },
      alwaysKnownPortal,
    );
    const approved = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
      },
      alwaysKnownPortal,
    );
    const pending = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
      },
      alwaysKnownPortal,
    );

    await recordModerationDecision(db, { submissionId: oldRejected.id, decision: "rejected" });
    await recordModerationDecision(db, { submissionId: recentRejected.id, decision: "rejected" });
    await recordModerationDecision(db, { submissionId: approved.id, decision: "approved" });

    // Back-date the old rejection's moderatedAt to 100 days ago, past the
    // default 90-day threshold; leave the "recent" one at "now".
    const oldModeratedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await db
      .update(experienceModeration)
      .set({ moderatedAt: oldModeratedAt })
      .where(eq(experienceModeration.submissionId, oldRejected.id));

    await recordAbuseKeyEvent(db, { keyedHash: "expired-hash", portalId: PORTAL_A, ttlHours: -1 });
    await recordAbuseKeyEvent(db, { keyedHash: "fresh-hash", portalId: PORTAL_A, ttlHours: 24 });

    const report = await runRetention(db, { rejectedRetentionDays: 90 });
    expect(report.rejectedSubmissionsDeleted).toBe(1);
    expect(report.expiredAbuseKeysDeleted).toBe(1);

    expect(await getSubmissionById(db, oldRejected.id)).toBeNull();
    expect(await getSubmissionById(db, recentRejected.id)).not.toBeNull();
    expect(await getSubmissionById(db, approved.id)).not.toBeNull();
    expect(await getSubmissionById(db, pending.id)).not.toBeNull();
  });
});
