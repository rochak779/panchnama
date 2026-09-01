import { describe, expect, it } from "vitest";
import { formatAuditDate } from "./formatDate";

describe("formatAuditDate", () => {
  it("formats an ISO timestamp as an unambiguous plain-English date", () => {
    expect(formatAuditDate("2026-09-15T02:00:00Z")).toBe("15 September 2026");
  });

  it("returns the original string unchanged for an unparseable value, rather than throwing", () => {
    expect(formatAuditDate("not-a-date")).toBe("not-a-date");
  });
});
