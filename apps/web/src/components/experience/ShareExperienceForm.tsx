"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ExperienceTheme, TaskOutcome } from "@panchnama/schema";
import {
  DEVICE_TYPE_LABELS,
  EXPERIENCE_THEME_LABELS,
  TASK_OUTCOME_LABELS,
  TASK_TYPE_LABELS,
  type DeviceType,
} from "@/lib/experienceLabels";
import { TASK_TYPE_OPTIONS, THEME_OPTIONS, type TaskTypeOption } from "@/lib/experienceOptions";
import {
  CONSENT_TO_PUBLISH_COPY,
  NOT_A_GRIEVANCE_CHANNEL_COPY,
  PRIVACY_WARNING_COPY,
} from "@/lib/experienceCopy";
import { submitExperience, type SubmitExperienceResult } from "@/lib/experienceApiClient";
import { VisuallyHidden } from "@/components/VisuallyHidden";
import styles from "./ShareExperienceForm.module.css";

export interface ShareExperienceFormProps {
  portalId: string;
  portalName: string;
}

const STEP_LABELS = [
  "Context",
  "Outcome",
  "What happened",
  "Privacy and consent",
  "Review and submit",
] as const;

const TASK_DESCRIPTION_MAX = 280;
const FREE_TEXT_MAX = 1000;

const RATING_OPTIONS: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: "1 — Very poor" },
  { value: 2, label: "2 — Poor" },
  { value: 3, label: "3 — Okay" },
  { value: 4, label: "4 — Good" },
  { value: 5, label: "5 — Very good" },
];

const DEVICE_TYPE_OPTIONS: DeviceType[] = ["mobile", "desktop", "tablet", "other"];

interface FormState {
  occurredOn: string;
  taskType: TaskTypeOption | "";
  taskDescription: string;
  deviceType: DeviceType | "";
  outcome: TaskOutcome | "";
  themes: ExperienceTheme[];
  experienceRating: 0 | 1 | 2 | 3 | 4 | 5;
  freeText: string;
  consentUnderstand: boolean;
  consentPublish: boolean;
}

const EMPTY_FORM_STATE: FormState = {
  occurredOn: "",
  taskType: "",
  taskDescription: "",
  deviceType: "",
  outcome: "",
  themes: [],
  experienceRating: 0,
  freeText: "",
  consentUnderstand: false,
  consentPublish: false,
};

type FieldErrors = Record<string, string>;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

/** Which step (1-4) owns each validated field, used to route the error
 * summary and any server-returned `fieldErrors` back to the right step. */
const FIELD_STEP: Record<string, number> = {
  taskType: 1,
  taskDescription: 1,
  outcome: 2,
  themes: 3,
  freeText: 3,
  consentUnderstand: 4,
  consentPublish: 4,
};

function draftStorageKey(portalId: string): string {
  return `panchnama:experience-draft:${portalId}`;
}

/** Best-effort sessionStorage read — some browsers/privacy modes throw on
 * access, so every call site treats this as advisory only. */
function readDraft(portalId: string): Partial<FormState> | null {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(portalId));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<FormState>;
  } catch {
    return null;
  }
}

function writeDraft(portalId: string, state: FormState): void {
  try {
    sessionStorage.setItem(draftStorageKey(portalId), JSON.stringify(state));
  } catch {
    // Best-effort only — never block submission/error handling on this.
  }
}

function clearDraft(portalId: string): void {
  try {
    sessionStorage.removeItem(draftStorageKey(portalId));
  } catch {
    // Best-effort only.
  }
}

function validateStep(step: number, data: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 1) {
    if (!data.taskType) {
      errors.taskType = "Select what you were trying to do.";
    }
    if (data.taskType === "other" && data.taskDescription.trim().length === 0) {
      errors.taskDescription = "Describe what you were trying to do.";
    }
    if (data.taskDescription.length > TASK_DESCRIPTION_MAX) {
      errors.taskDescription = `Keep this to ${TASK_DESCRIPTION_MAX} characters or fewer.`;
    }
  }
  if (step === 2) {
    if (!data.outcome) {
      errors.outcome = "Select what happened.";
    }
  }
  if (step === 3) {
    if (data.themes.length === 0) {
      errors.themes = "Select at least one.";
    }
    if (data.freeText.length > FREE_TEXT_MAX) {
      errors.freeText = `Keep this to ${FREE_TEXT_MAX} characters or fewer.`;
    }
  }
  if (step === 4) {
    if (!data.consentUnderstand) {
      errors.consentUnderstand =
        "You must confirm you understand this is not an official grievance channel.";
    }
    if (!data.consentPublish) {
      errors.consentPublish = "You must consent to review and possible publication to submit.";
    }
  }
  return errors;
}

function validateAll(data: FormState): { errors: FieldErrors; firstInvalidStep: number | null } {
  let firstInvalidStep: number | null = null;
  let errors: FieldErrors = {};
  for (const step of [1, 2, 3, 4]) {
    const stepErrors = validateStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      if (firstInvalidStep === null) firstInvalidStep = step;
      errors = { ...errors, ...stepErrors };
    }
  }
  return { errors, firstInvalidStep };
}

/**
 * Session 15 Task 2. The 5-stage share-an-experience form
 * (implementation.md section 10.5), implemented as internal step state
 * over one form-data object rather than five separate routes, so no
 * answer is lost moving between steps and the review step (5) can jump
 * back into any earlier step without a full reset.
 */
export function ShareExperienceForm({ portalId, portalName }: ShareExperienceFormProps) {
  const [step, setStep] = useState(1);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM_STATE);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  // Incremented every time validation fails, even repeatedly on the same
  // step, so the focus-the-summary effect below fires again (a boolean
  // alone wouldn't change if it was already `true`).
  const [errorNonce, setErrorNonce] = useState(0);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [result, setResult] = useState<SubmitExperienceResult | null>(null);

  const submittingRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Restore a draft saved after an earlier error in this tab session, if
  // one exists. Never restores the honeypot field.
  useEffect(() => {
    const draft = readDraft(portalId);
    if (draft) {
      setFormState((prev) => ({ ...prev, ...draft }));
    }
  }, [portalId]);

  useEffect(() => {
    if (showErrorSummary) {
      errorSummaryRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorNonce]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTheme(theme: ExperienceTheme) {
    setFormState((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }));
  }

  function goNext() {
    const stepErrors = validateStep(step, formState);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setShowErrorSummary(true);
      setErrorNonce((n) => n + 1);
      return;
    }
    setErrors({});
    setShowErrorSummary(false);
    setStep((s) => Math.min(s + 1, 5));
  }

  function goBack() {
    setErrors({});
    setShowErrorSummary(false);
    setStep((s) => Math.max(s - 1, 1));
  }

  function editStep(target: number) {
    setErrors({});
    setShowErrorSummary(false);
    setStep(target);
  }

  async function handleSubmit() {
    if (submittingRef.current) return;

    const { errors: allErrors, firstInvalidStep } = validateAll(formState);
    if (firstInvalidStep !== null) {
      setStep(firstInvalidStep);
      setErrors(allErrors);
      setShowErrorSummary(true);
      setErrorNonce((n) => n + 1);
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setErrors({});
    setShowErrorSummary(false);

    const payload = {
      occurredOn: formState.occurredOn.trim() || undefined,
      taskType: formState.taskType as TaskTypeOption,
      taskDescription: formState.taskDescription.trim() || undefined,
      outcome: formState.outcome as TaskOutcome,
      themes: formState.themes,
      deviceType: formState.deviceType || undefined,
      experienceRating: formState.experienceRating === 0 ? undefined : formState.experienceRating,
      freeText: formState.freeText.trim() || undefined,
      consentToPublish: formState.consentUnderstand && formState.consentPublish,
    };

    const submitResult = await submitExperience(portalId, payload, honeypot);
    submittingRef.current = false;
    setResult(submitResult);

    if (submitResult.ok) {
      setStatus("success");
      clearDraft(portalId);
      return;
    }

    setStatus("error");
    writeDraft(portalId, formState);

    if (submitResult.kind === "invalid" && submitResult.fieldErrors) {
      const mapped: FieldErrors = {};
      let firstStep: number | null = null;
      for (const [field, messages] of Object.entries(submitResult.fieldErrors)) {
        if (!messages || messages.length === 0) continue;
        mapped[field] = messages[0]!;
        const owningStep = FIELD_STEP[field];
        if (owningStep && (firstStep === null || owningStep < firstStep)) {
          firstStep = owningStep;
        }
      }
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        setShowErrorSummary(true);
        setErrorNonce((n) => n + 1);
        setStep(firstStep ?? 1);
      }
    }
  }

  if (status === "success" && result?.ok) {
    return (
      <section className={styles.successPanel} aria-labelledby="share-experience-success-heading">
        <h1 id="share-experience-success-heading">Thank you</h1>
        <p>{result.message}</p>
        <Link href={`/portals/${portalId}`}>Back to {portalName}</Link>
      </section>
    );
  }

  // Only list errors belonging to fields on the currently visible step —
  // multi-step validateAll() results can carry errors for other steps too,
  // but their fields aren't in the DOM until that step is reached, so a
  // link to them would go nowhere.
  const errorList = Object.entries(errors).filter(([field]) => FIELD_STEP[field] === step);

  return (
    <section className={styles.form} aria-labelledby="share-experience-heading">
      <h1 id="share-experience-heading">Share your experience — {portalName}</h1>
      <p className={styles.introNote}>
        This form is anonymous. Do not include your name, phone number, or any other identifying
        detail.
      </p>

      <ol className={styles.stepIndicator} aria-label="Form progress">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const current = stepNumber === step;
          return (
            <li
              key={label}
              className={current ? styles.stepCurrent : styles.step}
              aria-current={current ? "step" : undefined}
            >
              <span className={styles.stepNumber}>{stepNumber}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>

      {showErrorSummary && errorList.length > 0 ? (
        <div
          ref={errorSummaryRef}
          className={styles.errorSummary}
          role="alert"
          tabIndex={-1}
          aria-labelledby="error-summary-heading"
        >
          <h2 id="error-summary-heading">There is a problem</h2>
          <ul>
            {errorList.map(([field, message]) => (
              <li key={field}>
                <a href={`#field-${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status === "error" && result && !result.ok ? (
        <div className={styles.statusMessage} role="alert">
          {result.kind === "rate_limited" ? (
            <p>
              {result.message} Please try again later — your answers have been kept on this
              device so you do not need to re-enter them.
            </p>
          ) : result.kind === "unavailable" ? (
            <p>
              {result.message} Your answers have been kept on this device so you can try again
              without re-entering them.
            </p>
          ) : result.kind === "network" ? (
            <p>
              {result.message} Your answers have been kept on this device so you can try again
              without re-entering them.
            </p>
          ) : (
            <p>{result.message}</p>
          )}
        </div>
      ) : null}

      <form onSubmit={(e) => e.preventDefault()} noValidate>
        {/* Honeypot: name must be exactly "website" (HONEYPOT_FIELD_NAME).
            Visually hidden and unreachable by Tab for a real user, but
            present in the DOM at every step so an automated form-filler
            that populates every field it finds still fills it in. */}
        <VisuallyHidden>
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
          />
        </VisuallyHidden>

        {step === 1 ? (
          <fieldset className={styles.stepFieldset}>
            <legend className={styles.stepLegend}>1. Context</legend>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Portal</span>
              <p className={styles.readOnlyValue}>{portalName}</p>
            </div>

            <div className={styles.field}>
              <label htmlFor="field-occurredOn">
                Approximately when did this happen? (e.g. &ldquo;August 2026&rdquo;)
              </label>
              <input
                id="field-occurredOn"
                type="text"
                value={formState.occurredOn}
                onChange={(e) => updateField("occurredOn", e.target.value)}
              />
            </div>

            <fieldset id="field-taskType" tabIndex={-1} className={styles.field}>
              <legend>
                What were you trying to do? <span aria-hidden="true">*</span>
              </legend>
              <div className={styles.radioGroup}>
                {TASK_TYPE_OPTIONS.map((option) => (
                  <label key={option} className={styles.radioRow}>
                    <input
                      type="radio"
                      name="taskType"
                      value={option}
                      checked={formState.taskType === option}
                      onChange={() => updateField("taskType", option)}
                      aria-describedby={errors.taskType ? "field-taskType-error" : undefined}
                    />
                    {TASK_TYPE_LABELS[option]}
                  </label>
                ))}
              </div>
              {errors.taskType ? (
                <p id="field-taskType-error" className={styles.fieldError}>
                  {errors.taskType}
                </p>
              ) : null}
            </fieldset>

            {formState.taskType === "other" ? (
              <div className={styles.field}>
                <label htmlFor="field-taskDescription">Briefly describe what you were doing</label>
                <input
                  id="field-taskDescription"
                  type="text"
                  maxLength={TASK_DESCRIPTION_MAX}
                  value={formState.taskDescription}
                  onChange={(e) => updateField("taskDescription", e.target.value)}
                  aria-describedby={
                    errors.taskDescription
                      ? "field-taskDescription-error field-taskDescription-count"
                      : "field-taskDescription-count"
                  }
                />
                <p id="field-taskDescription-count" className={styles.charCount}>
                  {formState.taskDescription.length}/{TASK_DESCRIPTION_MAX} characters
                </p>
                {errors.taskDescription ? (
                  <p id="field-taskDescription-error" className={styles.fieldError}>
                    {errors.taskDescription}
                  </p>
                ) : null}
              </div>
            ) : null}

            <fieldset className={styles.field}>
              <legend>What device were you using? (optional)</legend>
              <div className={styles.radioGroup}>
                {DEVICE_TYPE_OPTIONS.map((option) => (
                  <label key={option} className={styles.radioRow}>
                    <input
                      type="radio"
                      name="deviceType"
                      value={option}
                      checked={formState.deviceType === option}
                      onChange={() => updateField("deviceType", option)}
                    />
                    {DEVICE_TYPE_LABELS[option]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.stepActions}>
              <button type="button" className={styles.primaryButton} onClick={goNext}>
                Next
              </button>
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset className={styles.stepFieldset}>
            <legend className={styles.stepLegend}>2. Outcome</legend>

            <fieldset id="field-outcome" tabIndex={-1} className={styles.field}>
              <legend>
                What happened? <span aria-hidden="true">*</span>
              </legend>
              <div className={styles.radioGroup}>
                {(Object.keys(TASK_OUTCOME_LABELS) as TaskOutcome[]).map((option) => (
                  <label key={option} className={styles.radioRow}>
                    <input
                      type="radio"
                      name="outcome"
                      value={option}
                      checked={formState.outcome === option}
                      onChange={() => updateField("outcome", option)}
                      aria-describedby={errors.outcome ? "field-outcome-error" : undefined}
                    />
                    {TASK_OUTCOME_LABELS[option]}
                  </label>
                ))}
              </div>
              {errors.outcome ? (
                <p id="field-outcome-error" className={styles.fieldError}>
                  {errors.outcome}
                </p>
              ) : null}
            </fieldset>

            <div className={styles.stepActions}>
              <button type="button" className={styles.secondaryButton} onClick={goBack}>
                Back
              </button>
              <button type="button" className={styles.primaryButton} onClick={goNext}>
                Next
              </button>
            </div>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset className={styles.stepFieldset}>
            <legend className={styles.stepLegend}>3. What happened</legend>

            <fieldset id="field-themes" tabIndex={-1} className={styles.field}>
              <legend>
                Which of these describe your experience? <span aria-hidden="true">*</span>
              </legend>
              <div className={styles.checkboxGroup}>
                {THEME_OPTIONS.map((theme) => (
                  <label key={theme} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      name="themes"
                      value={theme}
                      checked={formState.themes.includes(theme)}
                      onChange={() => toggleTheme(theme)}
                      aria-describedby={errors.themes ? "field-themes-error" : undefined}
                    />
                    {EXPERIENCE_THEME_LABELS[theme]}
                  </label>
                ))}
              </div>
              {errors.themes ? (
                <p id="field-themes-error" className={styles.fieldError}>
                  {errors.themes}
                </p>
              ) : null}
            </fieldset>

            <fieldset className={styles.field}>
              <legend>Overall, how would you rate this experience? (optional)</legend>
              <div className={styles.radioGroup}>
                {RATING_OPTIONS.map((option) => (
                  <label key={option.value} className={styles.radioRow}>
                    <input
                      type="radio"
                      name="experienceRating"
                      value={option.value}
                      checked={formState.experienceRating === option.value}
                      onChange={() => updateField("experienceRating", option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.field}>
              <p className={styles.privacyWarning}>{PRIVACY_WARNING_COPY}</p>
              <label htmlFor="field-freeText">Tell us more (optional)</label>
              <textarea
                id="field-freeText"
                rows={5}
                maxLength={FREE_TEXT_MAX}
                value={formState.freeText}
                onChange={(e) => updateField("freeText", e.target.value)}
                aria-describedby={
                  errors.freeText ? "field-freeText-error field-freeText-count" : "field-freeText-count"
                }
              />
              <p id="field-freeText-count" className={styles.charCount}>
                {formState.freeText.length}/{FREE_TEXT_MAX} characters
              </p>
              {errors.freeText ? (
                <p id="field-freeText-error" className={styles.fieldError}>
                  {errors.freeText}
                </p>
              ) : null}
            </div>

            <div className={styles.stepActions}>
              <button type="button" className={styles.secondaryButton} onClick={goBack}>
                Back
              </button>
              <button type="button" className={styles.primaryButton} onClick={goNext}>
                Next
              </button>
            </div>
          </fieldset>
        ) : null}

        {step === 4 ? (
          <fieldset className={styles.stepFieldset}>
            <legend className={styles.stepLegend}>4. Privacy and consent</legend>

            <p className={styles.policyCopy}>{NOT_A_GRIEVANCE_CHANNEL_COPY}</p>
            <p className={styles.policyCopy}>{CONSENT_TO_PUBLISH_COPY}</p>

            <div id="field-consentUnderstand" tabIndex={-1} className={styles.field}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={formState.consentUnderstand}
                  onChange={(e) => updateField("consentUnderstand", e.target.checked)}
                  aria-describedby={
                    errors.consentUnderstand ? "field-consentUnderstand-error" : undefined
                  }
                />
                I understand this is not an official grievance channel and Panchnama cannot
                resolve or forward my issue.
              </label>
              {errors.consentUnderstand ? (
                <p id="field-consentUnderstand-error" className={styles.fieldError}>
                  {errors.consentUnderstand}
                </p>
              ) : null}
            </div>

            <div id="field-consentPublish" tabIndex={-1} className={styles.field}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={formState.consentPublish}
                  onChange={(e) => updateField("consentPublish", e.target.checked)}
                  aria-describedby={errors.consentPublish ? "field-consentPublish-error" : undefined}
                />
                I consent to this being reviewed and, if approved, published in
                redacted/anonymous form.
              </label>
              {errors.consentPublish ? (
                <p id="field-consentPublish-error" className={styles.fieldError}>
                  {errors.consentPublish}
                </p>
              ) : null}
            </div>

            <div className={styles.stepActions}>
              <button type="button" className={styles.secondaryButton} onClick={goBack}>
                Back
              </button>
              <button type="button" className={styles.primaryButton} onClick={goNext}>
                Next
              </button>
            </div>
          </fieldset>
        ) : null}

        {step === 5 ? (
          <div className={styles.stepFieldset}>
            <h2 className={styles.stepLegend}>5. Review and submit</h2>

            <div className={styles.reviewGroup}>
              <div className={styles.reviewGroupHeader}>
                <h3>Context</h3>
                <button type="button" className={styles.editButton} onClick={() => editStep(1)}>
                  Edit<span className={styles.visuallyHiddenText}> context</span>
                </button>
              </div>
              <dl className={styles.reviewList}>
                <dt>Portal</dt>
                <dd>{portalName}</dd>
                <dt>When</dt>
                <dd>{formState.occurredOn || "Not specified"}</dd>
                <dt>What you were trying to do</dt>
                <dd>{formState.taskType ? TASK_TYPE_LABELS[formState.taskType] : "Not specified"}</dd>
                {formState.taskType === "other" ? (
                  <>
                    <dt>Description</dt>
                    <dd>{formState.taskDescription || "Not specified"}</dd>
                  </>
                ) : null}
                <dt>Device</dt>
                <dd>
                  {formState.deviceType ? DEVICE_TYPE_LABELS[formState.deviceType] : "Not specified"}
                </dd>
              </dl>
            </div>

            <div className={styles.reviewGroup}>
              <div className={styles.reviewGroupHeader}>
                <h3>Outcome</h3>
                <button type="button" className={styles.editButton} onClick={() => editStep(2)}>
                  Edit<span className={styles.visuallyHiddenText}> outcome</span>
                </button>
              </div>
              <dl className={styles.reviewList}>
                <dt>What happened</dt>
                <dd>{formState.outcome ? TASK_OUTCOME_LABELS[formState.outcome] : "Not specified"}</dd>
              </dl>
            </div>

            <div className={styles.reviewGroup}>
              <div className={styles.reviewGroupHeader}>
                <h3>What happened</h3>
                <button type="button" className={styles.editButton} onClick={() => editStep(3)}>
                  Edit<span className={styles.visuallyHiddenText}> what happened</span>
                </button>
              </div>
              <dl className={styles.reviewList}>
                <dt>Themes</dt>
                <dd>
                  {formState.themes.length > 0
                    ? formState.themes.map((t) => EXPERIENCE_THEME_LABELS[t]).join(", ")
                    : "Not specified"}
                </dd>
                <dt>Rating</dt>
                <dd>
                  {formState.experienceRating
                    ? RATING_OPTIONS.find((r) => r.value === formState.experienceRating)?.label
                    : "Not specified"}
                </dd>
                <dt>Description</dt>
                <dd>{formState.freeText || "Not specified"}</dd>
              </dl>
            </div>

            <div className={styles.reviewGroup}>
              <div className={styles.reviewGroupHeader}>
                <h3>Privacy and consent</h3>
                <button type="button" className={styles.editButton} onClick={() => editStep(4)}>
                  Edit<span className={styles.visuallyHiddenText}> privacy and consent</span>
                </button>
              </div>
              <p>Both consent statements confirmed.</p>
            </div>

            <div
              className={styles.submittingStatus}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {status === "submitting" ? "Submitting…" : ""}
            </div>

            <div className={styles.stepActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={goBack}
                disabled={status === "submitting"}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSubmit}
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
