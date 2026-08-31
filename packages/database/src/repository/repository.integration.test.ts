import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { experienceSubmissionSchema, portalExperienceSummarySchema } from "@panchnama/schema";
import {
  getTestDbAvailability,
  getTestDb,
  truncateExperienceTables,
  closeTestDb,
} from "../testSupport/testDb.js";
import { createPendingSubmission, getSubmissionById } from "./submissions.js";
import { listModerationQueue, recordModerationDecision } from "./moderation.js";
import { getApprovedExperiences, getPortalExperienceSummary } from "./reads.js";

const PORTAL_A = "portal-agri-assam";
const PORTAL_B = "portal-agri-farmers-welfare";
const alwaysKnownPortal = () => true;

// Availability must be resolved before `describe.skipIf` below is
// evaluated at collection time — vitest collects `describe` bodies
// synchronously before any `beforeAll` hook runs, so a top-level await
// (supported: this file is ESM) is what actually gates the suite, not a
// hook.
const dbAvailable = await getTestDbAvailability();

afterAll(async () => {
  await closeTestDb();
});

describe.skipIf(!dbAvailable)("repository integration tests", () => {
  beforeEach(async () => {
    await truncateExperienceTables();
  });

  it("creates a pending submission with a matching moderation row", async () => {
    const { db } = getTestDb();
    const submission = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
        freeText: "It worked fine.",
      },
      alwaysKnownPortal,
    );

    expect(submission.status).toBe("pending");
    expect(() => experienceSubmissionSchema.parse(submission)).not.toThrow();

    const fetched = await getSubmissionById(db, submission.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe("pending");
  });

  it("rejects an unknown portal id in application code before writing any row", async () => {
    const { db } = getTestDb();
    await expect(
      createPendingSubmission(
        db,
        {
          portalId: "portal-does-not-exist",
          taskType: "general_information",
          outcome: "completed",
          themes: ["navigation"],
          consentToPublish: true,
          source: "public_form",
          privacyFlags: [],
        },
        () => false,
      ),
    ).rejects.toThrow(/not a known published portal id/);

    const queue = await listModerationQueue(db);
    expect(queue).toHaveLength(0);
  });

  it("leaves no partial state when a transaction step fails (rollback)", async () => {
    const { db, client } = getTestDb();
    const before = await client<
      { count: string }[]
    >`select count(*)::text from experience_submissions`;

    await expect(
      db.transaction(async (tx) => {
        await createPendingSubmission(
          tx as unknown as typeof db,
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
        throw new Error("simulated failure after insert");
      }),
    ).rejects.toThrow("simulated failure after insert");

    const after = await client<
      { count: string }[]
    >`select count(*)::text from experience_submissions`;
    expect(after[0]?.count).toBe(before[0]?.count);
  });

  it("lists only pending submissions in the moderation queue, oldest first", async () => {
    const { db } = getTestDb();
    const first = await createPendingSubmission(
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
    const second = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_B,
        taskType: "scheme_enrollment",
        outcome: "not_completed",
        themes: ["availability"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
      },
      alwaysKnownPortal,
    );
    await recordModerationDecision(db, { submissionId: first.id, decision: "approved" });

    const queue = await listModerationQueue(db);
    expect(queue.map((item) => item.submissionId)).toEqual([second.id]);
  });

  it("approval visibility: only approved + consented submissions are publicly returned", async () => {
    const { db } = getTestDb();
    const approvedConsented = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
        freeText: "Great experience.",
      },
      alwaysKnownPortal,
    );
    const approvedNotConsented = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: false,
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
    const rejected = await createPendingSubmission(
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

    await recordModerationDecision(db, {
      submissionId: approvedConsented.id,
      decision: "approved",
    });
    await recordModerationDecision(db, {
      submissionId: approvedNotConsented.id,
      decision: "approved",
    });
    void pending;
    await recordModerationDecision(db, { submissionId: rejected.id, decision: "rejected" });

    const { items, total } = await getApprovedExperiences(db, PORTAL_A);
    expect(total).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0]?.submissionId).toBe(approvedConsented.id);
  });

  it("redaction preservation: publicText is returned, original freeText is never returned, and the original row is untouched", async () => {
    const { db } = getTestDb();
    const submission = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_A,
        taskType: "general_information",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: ["possible_phone_number"],
        freeText: "Call me at 98765 43210 please.",
      },
      alwaysKnownPortal,
    );
    await recordModerationDecision(db, {
      submissionId: submission.id,
      decision: "needs_redaction",
      publicText: "Please contact via the helpline.",
    });

    const { items } = await getApprovedExperiences(db, PORTAL_A);
    expect(items).toHaveLength(0); // needs_redaction is not approved

    await recordModerationDecision(db, {
      submissionId: submission.id,
      decision: "approved",
      publicText: "Please contact via the helpline.",
    });
    const { items: approvedItems } = await getApprovedExperiences(db, PORTAL_A);
    expect(approvedItems).toHaveLength(1);
    expect(approvedItems[0]?.publicText).toBe("Please contact via the helpline.");
    expect(JSON.stringify(approvedItems[0])).not.toContain("98765");

    const original = await getSubmissionById(db, submission.id);
    expect(original?.freeText).toBe("Call me at 98765 43210 please.");
  });

  it("aggregate excludes pending and rejected submissions", async () => {
    const { db } = getTestDb();
    const approved = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_B,
        taskType: "scheme_enrollment",
        outcome: "completed",
        themes: ["navigation"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
        experienceRating: 5,
      },
      alwaysKnownPortal,
    );
    await createPendingSubmission(
      db,
      {
        portalId: PORTAL_B,
        taskType: "scheme_enrollment",
        outcome: "not_completed",
        themes: ["availability"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
      },
      alwaysKnownPortal,
    ); // stays pending
    const rejected = await createPendingSubmission(
      db,
      {
        portalId: PORTAL_B,
        taskType: "scheme_enrollment",
        outcome: "not_completed",
        themes: ["availability"],
        consentToPublish: true,
        source: "public_form",
        privacyFlags: [],
      },
      alwaysKnownPortal,
    );
    await recordModerationDecision(db, { submissionId: approved.id, decision: "approved" });
    await recordModerationDecision(db, { submissionId: rejected.id, decision: "rejected" });

    const summary = await getPortalExperienceSummary(db, PORTAL_B);
    expect(() => portalExperienceSummarySchema.parse(summary)).not.toThrow();
    expect(summary.approvedExperienceCount).toBe(1);
    expect(summary.outcomeCounts.completed).toBe(1);
    expect(summary.outcomeCounts.not_completed).toBe(0);
  });

  it("handles two near-simultaneous moderation decisions without corrupting state", async () => {
    const { db } = getTestDb();
    const submission = await createPendingSubmission(
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

    const results = await Promise.allSettled([
      recordModerationDecision(db, { submissionId: submission.id, decision: "approved" }),
      recordModerationDecision(db, { submissionId: submission.id, decision: "rejected" }),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const final = await getSubmissionById(db, submission.id);
    expect(["approved", "rejected"]).toContain(final?.status);

    const { client } = getTestDb();
    const rows = await client<{ count: string }[]>`
      select count(*)::text from experience_moderation where submission_id = ${submission.id}
    `;
    expect(rows[0]?.count).toBe("1");
  });
});
