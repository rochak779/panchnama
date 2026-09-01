import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getTestDbAvailability,
  getTestDb,
  truncateExperienceTables,
  closeTestDb,
} from "../testSupport/testDb.js";
import { createPendingSubmission } from "./submissions.js";
import { recordModerationDecision } from "./moderation.js";
import { findDuplicateCandidates } from "./duplicates.js";

const PORTAL_A = "portal-agri-assam";
const alwaysKnownPortal = () => true;

const dbAvailable = await getTestDbAvailability();

afterAll(async () => {
  await closeTestDb();
});

describe.skipIf(!dbAvailable)("findDuplicateCandidates", () => {
  beforeEach(async () => {
    await truncateExperienceTables();
  });

  async function seedSubmission(
    overrides: {
      portalId?: string;
      taskType?: string;
      outcome?: "completed" | "partially_completed" | "not_completed" | "information_only";
      freeText?: string;
    } = {},
  ) {
    const { db } = getTestDb();
    return createPendingSubmission(
      db,
      {
        portalId: overrides.portalId ?? PORTAL_A,
        taskType: overrides.taskType ?? "general_information",
        outcome: overrides.outcome ?? "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
        freeText: overrides.freeText ?? "It worked fine.",
      },
      alwaysKnownPortal,
    );
  }

  it("returns a pending submission matching portalId/taskType/outcome within the time window", async () => {
    const { db } = getTestDb();
    const submission = await seedSubmission();

    const candidates = await findDuplicateCandidates(db, {
      portalId: PORTAL_A,
      taskType: "general_information",
      outcome: "completed",
      sinceMinutes: 10,
    });

    expect(candidates.map((c) => c.id)).toContain(submission.id);
  });

  it("excludes a submission outside the time window", async () => {
    const { db } = getTestDb();
    await seedSubmission();

    const candidates = await findDuplicateCandidates(db, {
      portalId: PORTAL_A,
      taskType: "general_information",
      outcome: "completed",
      sinceMinutes: 10,
      // "now" far in the future means the seeded row falls outside the
      // 10-minute lookback window.
      now: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(candidates).toHaveLength(0);
  });

  it("excludes submissions for a different portal, taskType, or outcome", async () => {
    const { db } = getTestDb();
    await seedSubmission();

    const byPortal = await findDuplicateCandidates(db, {
      portalId: "portal-agri-farmers-welfare",
      taskType: "general_information",
      outcome: "completed",
      sinceMinutes: 10,
    });
    expect(byPortal).toHaveLength(0);

    const byTaskType = await findDuplicateCandidates(db, {
      portalId: PORTAL_A,
      taskType: "make_a_payment",
      outcome: "completed",
      sinceMinutes: 10,
    });
    expect(byTaskType).toHaveLength(0);

    const byOutcome = await findDuplicateCandidates(db, {
      portalId: PORTAL_A,
      taskType: "general_information",
      outcome: "not_completed",
      sinceMinutes: 10,
    });
    expect(byOutcome).toHaveLength(0);
  });

  it("excludes a rejected submission (never a duplicate target)", async () => {
    const { db } = getTestDb();
    const submission = await seedSubmission();
    await recordModerationDecision(db, { submissionId: submission.id, decision: "rejected" });

    const candidates = await findDuplicateCandidates(db, {
      portalId: PORTAL_A,
      taskType: "general_information",
      outcome: "completed",
      sinceMinutes: 10,
    });
    expect(candidates.map((c) => c.id)).not.toContain(submission.id);
  });

  it("includes an approved submission as a valid duplicate target", async () => {
    const { db } = getTestDb();
    const submission = await seedSubmission();
    await recordModerationDecision(db, { submissionId: submission.id, decision: "approved" });

    const candidates = await findDuplicateCandidates(db, {
      portalId: PORTAL_A,
      taskType: "general_information",
      outcome: "completed",
      sinceMinutes: 10,
    });
    expect(candidates.map((c) => c.id)).toContain(submission.id);
  });
});
