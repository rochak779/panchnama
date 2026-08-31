import { describe, expect, it } from "vitest";
import { parseRobotsTxt, robotsAllows } from "./robots-txt.js";

describe("parseRobotsTxt / robotsAllows", () => {
  it("allows everything when robots.txt has no matching rules", () => {
    const rules = parseRobotsTxt("");
    expect(robotsAllows(rules, "PanchnamaAuditBot", "/anything")).toBe(true);
  });

  it("respects a wildcard Disallow group", () => {
    const rules = parseRobotsTxt(["User-agent: *", "Disallow: /private"].join("\n"));
    expect(robotsAllows(rules, "PanchnamaAuditBot", "/private/page")).toBe(false);
    expect(robotsAllows(rules, "PanchnamaAuditBot", "/public/page")).toBe(true);
  });

  it("prefers a named group over the wildcard group", () => {
    const rules = parseRobotsTxt(
      [
        "User-agent: *",
        "Disallow: /",
        "",
        "User-agent: PanchnamaAuditBot",
        "Disallow: /admin",
      ].join("\n"),
    );
    expect(robotsAllows(rules, "PanchnamaAuditBot/0.1", "/home")).toBe(true);
    expect(robotsAllows(rules, "PanchnamaAuditBot/0.1", "/admin/x")).toBe(false);
  });

  it("longest match wins between Allow and Disallow", () => {
    const rules = parseRobotsTxt(
      ["User-agent: *", "Disallow: /docs", "Allow: /docs/public"].join("\n"),
    );
    expect(robotsAllows(rules, "bot", "/docs/secret")).toBe(false);
    expect(robotsAllows(rules, "bot", "/docs/public/file")).toBe(true);
  });

  it("supports wildcard and end anchor in patterns", () => {
    const rules = parseRobotsTxt(["User-agent: *", "Disallow: /*.pdf$"].join("\n"));
    expect(robotsAllows(rules, "bot", "/file.pdf")).toBe(false);
    expect(robotsAllows(rules, "bot", "/file.pdf.html")).toBe(true);
  });

  it("ignores comments and blank lines", () => {
    const rules = parseRobotsTxt(
      ["# comment", "", "User-agent: *", "# another comment", "Disallow: /x"].join("\n"),
    );
    expect(robotsAllows(rules, "bot", "/x")).toBe(false);
  });

  it("homepage allowed, deeper path disallowed is expressible", () => {
    const rules = parseRobotsTxt(["User-agent: *", "Disallow: /deep/"].join("\n"));
    expect(robotsAllows(rules, "bot", "/")).toBe(true);
    expect(robotsAllows(rules, "bot", "/deep/page")).toBe(false);
  });
});
