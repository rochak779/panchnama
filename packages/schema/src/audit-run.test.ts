import { describe, expect, it } from "vitest";
import { auditRunSchema } from "./audit-run.js";
import { validAuditRun } from "./fixtures/valid.js";

describe("auditRunSchema", () => {
  it("parses a valid fixture", () => {
    expect(auditRunSchema.parse(validAuditRun)).toEqual(validAuditRun);
  });

  it("rejects when portal counts don't sum to portalCount", () => {
    const result = auditRunSchema.safeParse({
      ...validAuditRun,
      portalCount: 2,
      portalsSucceeded: 1,
      portalsFailed: 0,
      portalsPartial: 0, // sums to 1, not 2
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "portalCount")).toBe(true);
    }
  });

  it("rejects a terminal status without completedAt", () => {
    const { completedAt: _completedAt, ...rest } = validAuditRun;
    const result = auditRunSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "completedAt")).toBe(true);
    }
  });

  it("allows 'running' status without completedAt", () => {
    const { completedAt: _completedAt, ...withoutCompletedAt } = validAuditRun;
    const running = {
      ...withoutCompletedAt,
      status: "running" as const,
      portalsSucceeded: 0,
      portalsFailed: 0,
      portalsPartial: 0,
      portalCount: 0,
    };
    expect(auditRunSchema.parse(running).status).toBe("running");
  });

  it("rejects status 'completed' when not every portal succeeded", () => {
    const result = auditRunSchema.safeParse({
      ...validAuditRun,
      status: "completed",
      portalCount: 2,
      portalsSucceeded: 1,
      portalsFailed: 0,
      portalsPartial: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "status")).toBe(true);
    }
  });

  it("rejects status 'failed' when some portals succeeded", () => {
    const result = auditRunSchema.safeParse({
      ...validAuditRun,
      status: "failed",
      portalCount: 2,
      portalsSucceeded: 1,
      portalsFailed: 1,
      portalsPartial: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "status")).toBe(true);
    }
  });
});
