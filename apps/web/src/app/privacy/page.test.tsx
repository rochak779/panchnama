// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { MODERATION_DISCLAIMER_COPY, REMOVAL_CONTACT_COPY } from "@/lib/experienceCopy";
import PrivacyPage from "./page";

describe("PrivacyPage (adapts docs/experience-privacy-and-moderation.md for the public)", () => {
  it("renders the moderation disclaimer and removal-contact copy verbatim from experienceCopy.ts", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(MODERATION_DISCLAIMER_COPY)).toBeInTheDocument();
    expect(screen.getByText(REMOVAL_CONTACT_COPY)).toBeInTheDocument();
  });

  it("covers the moderation policy and retention policy", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /moderation policy/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /retention/i })).toBeInTheDocument();
    expect(
      screen.getByText(/deleted 90 days after the rejection decision/i),
    ).toBeInTheDocument();
  });

  it("contains no internal file-path or code-module references", () => {
    render(<PrivacyPage />);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("abuseKey.ts");
    expect(text).not.toContain("privacyFlags.ts");
    expect(text).not.toContain("apps/web/src/lib");
    expect(text).not.toContain(".ts");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<PrivacyPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
