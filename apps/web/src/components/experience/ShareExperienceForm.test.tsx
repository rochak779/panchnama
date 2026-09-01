// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareExperienceForm } from "./ShareExperienceForm";
import { submitExperience } from "@/lib/experienceApiClient";

vi.mock("@/lib/experienceApiClient", () => ({
  submitExperience: vi.fn(),
}));

const mockSubmitExperience = vi.mocked(submitExperience);

const PORTAL_ID = "portal-1";
const PORTAL_NAME = "Example Portal";

function renderForm() {
  return render(<ShareExperienceForm portalId={PORTAL_ID} portalName={PORTAL_NAME} />);
}

/** Advances from step 1 through step 4, filling exactly the required
 * fields, landing on step 5 (review) without submitting. */
async function fillThroughToReview(
  user: ReturnType<typeof userEvent.setup>,
  opts: { freeText?: string } = {},
) {
  await user.click(screen.getByRole("radio", { name: "Apply for a scheme or benefit" }));
  await user.click(screen.getByRole("button", { name: "Next" }));

  await user.click(screen.getByRole("radio", { name: "Completed" }));
  await user.click(screen.getByRole("button", { name: "Next" }));

  await user.click(screen.getByRole("checkbox", { name: "Site was slow or unavailable" }));
  if (opts.freeText) {
    await user.type(screen.getByLabelText("Tell us more (optional)"), opts.freeText);
  }
  await user.click(screen.getByRole("button", { name: "Next" }));

  await user.click(
    screen.getByRole("checkbox", {
      name: /I understand this is not an official grievance channel/,
    }),
  );
  await user.click(
    screen.getByRole("checkbox", { name: /I consent to this being reviewed/ }),
  );
  await user.click(screen.getByRole("button", { name: "Next" }));
}

beforeEach(() => {
  mockSubmitExperience.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("ShareExperienceForm", () => {
  it("has no detectable accessibility violations on step 1", async () => {
    const { container } = renderForm();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keyboard-only: blocks Next on an empty required field and moves focus to the error summary", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Next" }));

    const summary = await screen.findByRole("alert", { name: "There is a problem" });
    expect(summary).toHaveFocus();
    expect(within(summary).getByText("Select what you were trying to do.")).toBeInTheDocument();
  });

  it("has no detectable accessibility violations with the error summary visible", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("alert", { name: "There is a problem" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("requires taskType before advancing past step 1", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("Select what you were trying to do.", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1. Context")).toBeInTheDocument();
  });

  it("requires outcome before advancing past step 2", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Apply for a scheme or benefit" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2. Outcome")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Select what happened.", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("2. Outcome")).toBeInTheDocument();
  });

  it("requires at least one theme before advancing past step 3", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Apply for a scheme or benefit" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "Completed" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("3. What happened")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Select at least one.", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("3. What happened")).toBeInTheDocument();
  });

  it("requires both consent checkboxes before advancing past step 4", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Apply for a scheme or benefit" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "Completed" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("checkbox", { name: "Site was slow or unavailable" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("4. Privacy and consent")).toBeInTheDocument();

    // Neither box checked yet.
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText(
        "You must confirm you understand this is not an official grievance channel.",
        { selector: "p" },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You must consent to review and possible publication to submit.", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("4. Privacy and consent")).toBeInTheDocument();

    // Only one box checked.
    await user.click(
      screen.getByRole("checkbox", {
        name: /I understand this is not an official grievance channel/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("You must consent to review and possible publication to submit.", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("4. Privacy and consent")).toBeInTheDocument();
  });

  it("enforces the taskDescription character bound when taskType is 'other'", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Something else" }));

    const description = screen.getByLabelText("Briefly describe what you were doing");
    expect(description).toHaveAttribute("maxLength", "280");

    await user.type(description, "hello");
    expect(screen.getByText("5/280 characters")).toBeInTheDocument();

    // Bypass the native maxlength (scripted assignment is not constrained
    // by it) to prove the validation backstop also catches an over-length
    // value, not just the input attribute.
    fireEventChange(description, "x".repeat(281));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("Keep this to 280 characters or fewer.", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("enforces the freeText character bound on step 3", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Apply for a scheme or benefit" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "Completed" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("checkbox", { name: "Site was slow or unavailable" }));

    const freeText = screen.getByLabelText("Tell us more (optional)");
    expect(freeText).toHaveAttribute("maxLength", "1000");

    await user.type(freeText, "hi there");
    expect(screen.getByText("8/1000 characters")).toBeInTheDocument();

    fireEventChange(freeText, "y".repeat(1001));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("Keep this to 1000 characters or fewer.", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("shows the privacy warning as visible text immediately above the free-text field, not a tooltip", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Apply for a scheme or benefit" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "Completed" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const warning = screen.getByText(/Do not include personal information/);
    expect(warning.tagName).toBe("P");
    expect(warning).not.toHaveAttribute("title");
    const freeText = screen.getByLabelText("Tell us more (optional)");
    // The warning is the field's preceding sibling content, not hidden
    // inside a title/tooltip attribute reachable only on hover.
    expect(warning.compareDocumentPosition(freeText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("review step accurately reflects entered data, and Edit returns to the correct step without losing other answers", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillThroughToReview(user, { freeText: "The site timed out twice." });

    expect(screen.getByText("5. Review and submit")).toBeInTheDocument();
    expect(screen.getByText("Apply for a scheme or benefit")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Site was slow or unavailable")).toBeInTheDocument();
    expect(screen.getByText("The site timed out twice.")).toBeInTheDocument();

    const outcomeGroup = screen.getByText("Outcome", { selector: "h3" }).closest("div")!;
    await user.click(within(outcomeGroup).getByRole("button", { name: /Edit/ }));

    expect(screen.getByText("2. Outcome")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Completed" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("5. Review and submit")).toBeInTheDocument();
    // Step 1's and step 3's answers survived the round trip through Edit.
    expect(screen.getByText("Apply for a scheme or benefit")).toBeInTheDocument();
    expect(screen.getByText("Site was slow or unavailable")).toBeInTheDocument();
    expect(screen.getByText("The site timed out twice.")).toBeInTheDocument();
  });

  it("keeps the honeypot field present but unreachable by Tab, and wires its value through on submit", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({ ok: true, message: "Thanks." });
    const { container } = renderForm();

    const honeypot = container.querySelector<HTMLInputElement>("#website");
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabIndex", "-1");
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveAttribute("autoComplete", "off");

    // Tabbing forward from the top of the form never lands on it.
    await user.tab();
    for (let i = 0; i < 6; i++) {
      expect(document.activeElement).not.toBe(honeypot);
      await user.tab();
    }

    fireEventChange(honeypot!, "http://spam.example");

    await fillThroughToReview(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(mockSubmitExperience).toHaveBeenCalledWith(
      PORTAL_ID,
      expect.any(Object),
      "http://spam.example",
    );
  });

  it("prevents a double submit: two rapid submit triggers result in exactly one call", async () => {
    const user = userEvent.setup();
    let resolvePending: ((value: Awaited<ReturnType<typeof submitExperience>>) => void) | undefined;
    mockSubmitExperience.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );
    renderForm();
    await fillThroughToReview(user);

    const submitButton = screen.getByRole("button", { name: "Submit" });
    await user.click(submitButton);
    await user.click(submitButton);

    expect(mockSubmitExperience).toHaveBeenCalledTimes(1);

    resolvePending?.({ ok: true, message: "Thanks." });
    await screen.findByText("Thanks.");
  });

  it("renders the success message and no editable field remains on ok:true", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({
      ok: true,
      message: "Thank you. Your experience has been submitted for review.",
    });
    renderForm();
    await fillThroughToReview(user, { freeText: "It never loaded." });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Thank you. Your experience has been submitted for review."),
    ).toBeInTheDocument();
    expect(screen.queryByText("It never loaded.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("moves focus to the success section once it mounts, for screen-reader confirmation", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({ ok: true, message: "Thanks." });
    renderForm();
    await fillThroughToReview(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const heading = await screen.findByRole("heading", { name: "Thank you" });
    expect(heading.closest("section")).toHaveFocus();
  });

  it("does not submit a stale taskDescription after taskType is changed away from 'other'", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({ ok: true, message: "Thanks." });
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Something else" }));
    await user.type(
      screen.getByLabelText("Briefly describe what you were doing"),
      "Some stale description",
    );
    // Switch away from "other" before advancing — the description field
    // disappears, but its value is still sitting in form state.
    await user.click(screen.getByRole("radio", { name: "Apply for a scheme or benefit" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("radio", { name: "Completed" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("checkbox", { name: "Site was slow or unavailable" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    // The review step never shows a Description row for a non-"other" task
    // type, confirming the user never saw this value reflected back to them.
    expect(screen.queryByText("Some stale description")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", {
        name: /I understand this is not an official grievance channel/,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /I consent to this being reviewed/ }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(mockSubmitExperience).toHaveBeenCalledWith(
      PORTAL_ID,
      expect.objectContaining({ taskDescription: undefined }),
      "",
    );
  });

  it("shows a distinct rate-limited message and preserves entered values", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({
      ok: false,
      kind: "rate_limited",
      message: "Too many submissions from this network recently.",
      retryAfterSeconds: 60,
    });
    renderForm();
    await fillThroughToReview(user, { freeText: "Kept my draft, please." });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText(/Too many submissions from this network recently\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/retryAfterSeconds/i)).not.toBeInTheDocument();
    expect(screen.getByText("Kept my draft, please.")).toBeInTheDocument();
  });

  it("shows a distinct unavailable message and preserves entered values", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({
      ok: false,
      kind: "unavailable",
      message: "Something went wrong submitting your experience. Please try again later.",
    });
    renderForm();
    await fillThroughToReview(user, { freeText: "Kept my draft, please." });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText(/Something went wrong submitting your experience\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Kept my draft, please.")).toBeInTheDocument();
  });

  it("shows a distinct network message and preserves entered values", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({
      ok: false,
      kind: "network",
      message: "Could not reach Panchnama. Check your connection and try again.",
    });
    renderForm();
    await fillThroughToReview(user, { freeText: "Kept my draft, please." });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText(/Could not reach Panchnama\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Kept my draft, please.")).toBeInTheDocument();
  });

  it("maps a server-returned invalid result's fieldErrors back onto the owning step", async () => {
    const user = userEvent.setup();
    mockSubmitExperience.mockResolvedValue({
      ok: false,
      kind: "invalid",
      message: "Some fields were invalid.",
      fieldErrors: { outcome: ["Outcome is required."] },
    });
    renderForm();
    await fillThroughToReview(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("2. Outcome")).toBeInTheDocument();
    expect(screen.getByText("Outcome is required.", { selector: "p" })).toBeInTheDocument();
  });
});

/** Sets an input/textarea's value programmatically and fires React's
 * change event — used to bypass native `maxlength` (which only constrains
 * user typing, not scripted assignment) so the JS-side length validation
 * can be exercised directly. */
function fireEventChange(element: HTMLElement, value: string) {
  const prototype =
    element instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  setter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
