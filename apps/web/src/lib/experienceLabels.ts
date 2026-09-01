import type { TaskOutcome, ExperienceTheme } from "@panchnama/schema";
import type { TaskTypeOption } from "./experienceOptions";

/**
 * Human-readable label maps for every controlled-vocabulary value the
 * experience submission form and approved-experience list can show a
 * citizen. A raw enum value (e.g. `login_or_otp`) must never reach the UI —
 * every place that renders one of these values looks it up here instead.
 *
 * Value lists are imported from `@panchnama/schema` / `experienceOptions.ts`
 * rather than redeclared, so this file only ever adds labels, never a new
 * source of truth for which values exist.
 */

/** A DeviceType union matching `experienceSubmissionSchema`'s inline
 * `deviceType` enum (`packages/schema/src/experience.ts`), which does not
 * export a standalone type of its own. */
export type DeviceType = "mobile" | "desktop" | "tablet" | "other";

export const TASK_OUTCOME_LABELS: Record<TaskOutcome, string> = {
  completed: "Completed",
  partially_completed: "Partially completed",
  not_completed: "Not completed",
  information_only: "Just looking for information",
};

export const EXPERIENCE_THEME_LABELS: Record<ExperienceTheme, string> = {
  availability: "Site was slow or unavailable",
  navigation: "Hard to find the right page",
  content_clarity: "Confusing or unclear content",
  outdated_information: "Outdated information",
  login_or_otp: "Login or OTP problems",
  form_or_validation: "Form or validation problems",
  payment: "Payment problems",
  document_upload: "Document upload problems",
  mobile_usability: "Hard to use on a mobile phone",
  language: "Language or translation problems",
  accessibility: "Accessibility problems",
  support: "Could not find help or support",
  other: "Something else",
};

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  mobile: "Mobile phone",
  desktop: "Desktop or laptop computer",
  tablet: "Tablet",
  other: "Other device",
};

export const TASK_TYPE_LABELS: Record<TaskTypeOption, string> = {
  apply_for_scheme_or_benefit: "Apply for a scheme or benefit",
  check_application_or_case_status: "Check an application or case status",
  download_or_view_document: "Download or view a document",
  make_a_payment: "Make a payment",
  find_information: "Find information",
  register_a_complaint_or_grievance: "Register a complaint or grievance",
  renew_license_or_certificate: "Renew a license or certificate",
  create_or_update_account: "Create or update an account",
  other: "Something else",
};
