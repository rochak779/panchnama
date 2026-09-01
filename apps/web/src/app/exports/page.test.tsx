// @vitest-environment jsdom
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { METHODOLOGY_VERSION_HISTORY } from "@/lib/methodologyContent";
import ExportsPage from "./page";

const REAL_EXPORTS_DIR = join(process.cwd(), "public", "exports");

const EXPECTED_FILES = [
  "audit-summary.json",
  "portals.json",
  "findings.json",
  "assam-audit.csv",
  "methodology.json",
] as const;

describe("ExportsPage with the real generated export files (end-to-end download integrity)", () => {
  it("lists all 5 download links with correct hrefs and a non-zero file size", () => {
    render(<ExportsPage exportsDir={REAL_EXPORTS_DIR} />);

    for (const filename of EXPECTED_FILES) {
      const link = screen.getByRole("link", { name: new RegExp(`Download ${filename}$`) });
      expect(link).toHaveAttribute("href", `/exports/${filename}`);
      expect(link).toHaveAttribute("download");
    }

    // Every size cell shows a non-zero KB value, e.g. "2.1 KB" — never "0.0 KB".
    const sizeMatches = screen.getAllByText(/^\d+\.\d KB$/);
    expect(sizeMatches.length).toBe(EXPECTED_FILES.length);
    for (const match of sizeMatches) {
      expect(match.textContent).not.toBe("0.0 KB");
    }
  });

  it("renders the METHODOLOGY_VERSION_HISTORY entries as the changelog", () => {
    render(<ExportsPage exportsDir={REAL_EXPORTS_DIR} />);

    for (const entry of METHODOLOGY_VERSION_HISTORY) {
      expect(screen.getByText(entry.version)).toBeInTheDocument();
      expect(screen.getByText(entry.date)).toBeInTheDocument();
      expect(screen.getByText(entry.summary)).toBeInTheDocument();
    }
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<ExportsPage exportsDir={REAL_EXPORTS_DIR} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ExportsPage with a missing export file (dependency-injected temp directory)", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "panchnama-exports-test-"));
    // Write every file except audit-summary.json, so that one row must
    // render as unavailable while the other four still render normally.
    for (const filename of EXPECTED_FILES) {
      if (filename === "audit-summary.json") continue;
      writeFileSync(join(tempDir, filename), "placeholder content", "utf8");
    }
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("renders the missing file as an 'unavailable' row instead of throwing", () => {
    expect(() => render(<ExportsPage exportsDir={tempDir} />)).not.toThrow();

    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: /Download audit-summary\.json/ }),
    ).not.toBeInTheDocument();
  });

  it("still renders working download links for the files that are present", () => {
    render(<ExportsPage exportsDir={tempDir} />);

    for (const filename of EXPECTED_FILES) {
      if (filename === "audit-summary.json") continue;
      const link = screen.getByRole("link", { name: new RegExp(`Download ${filename}$`) });
      expect(link).toHaveAttribute("href", `/exports/${filename}`);
    }
  });

  it("has no detectable accessibility violations even with a missing file", async () => {
    const { container } = render(<ExportsPage exportsDir={tempDir} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
