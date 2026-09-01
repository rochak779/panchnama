import type { Metadata } from "next";
import { MODERATION_DISCLAIMER_COPY, REMOVAL_CONTACT_COPY } from "@/lib/experienceCopy";
import styles from "../methodology/methodology.module.css";

export const metadata: Metadata = { title: "Privacy & moderation policy" };

/**
 * Session 16, Task 2 — a public, non-technical adaptation of
 * `docs/experience-privacy-and-moderation.md` (the developer/reviewer
 * source policy). Every substantive claim below traces back to that
 * document; internal file/code references (e.g. the abuse-key hashing
 * module, the privacy-pattern-flag module) are deliberately left out of
 * this citizen-facing page. The moderation-disclaimer and removal-contact
 * copy are imported verbatim from Session 15's `experienceCopy.ts` rather
 * than re-typed here, so there is exactly one source of truth for that
 * text across the submission form, the approved-experience list, and this
 * page.
 */
export default function PrivacyPage() {
  return (
    <main id="main-content">
      <div className={styles.container}>
        <div className={styles.hero}>
          <h1>Privacy &amp; moderation policy</h1>
          <p>
            How Panchnama handles a citizen&apos;s anonymous experience submission — what is
            collected, how it is moderated, how long it is kept, and how to ask for one to be
            removed.
          </p>
        </div>

        <section className={styles.section} aria-labelledby="what-we-collect-heading">
          <h2 id="what-we-collect-heading">What Panchnama collects</h2>
          <p className={styles.prose}>
            An anonymous experience submission is a structured account of one attempt to use one
            listed government portal: which task, what happened, an optional free-text
            description, and optional consent to publish. Panchnama does not ask for names,
            accounts, identity numbers, application numbers, phone numbers, or documents. No
            submission requires a login or account.
          </p>
          <p className={styles.prose}>
            Panchnama never stores a citizen&apos;s raw IP address or network address. It stores
            only a one-way, irreversible scrambled version of it, used solely to limit abuse (for
            example, rate-limiting) and to detect near-duplicate submissions. This scrambled value
            cannot be turned back into the original address.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="privacy-flags-heading">
          <h2 id="privacy-flags-heading">Privacy-pattern flags</h2>
          <p className={styles.prose}>
            Free-text fields are scanned for patterns that commonly indicate personal or
            identifying information — for example, text that looks like an email address, a
            mobile number, or an identity, application, or account number. We scan for these
            patterns and flag them for a moderator; we don&apos;t block or reject a submission
            automatically. A flag is a detection aid for the human reviewer, not proof that a
            submission does or does not contain personal information, and not proof that an
            unflagged submission is safe to publish as-is.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="moderation-policy-heading">
          <h2 id="moderation-policy-heading">Moderation policy</h2>
          <p className={styles.prose}>
            Every submission is held privately and is invisible to the public until a human
            moderator reviews it. A moderator approves a submission only when it describes a
            first-hand or clearly attributed portal experience, relates to the selected portal,
            contains no personal, identity, application, payment, or confidential information,
            includes no threats, abuse, spam, promotional content, or unverifiable accusations
            about individuals, is understandable enough to categorize, and includes consent to
            publish.
          </p>
          <p className={styles.prose}>
            A moderator may redact personal information out of a submission before publishing it,
            but must not silently rewrite its meaning. Every moderation decision is recorded with
            a reason.
          </p>
          <p className={styles.prose}>
            Experiences never feed into audit health, severity, or suggested-action calculations
            — they are kept and reviewed entirely separately from the technical audit findings.
          </p>
          <p className={styles.callout}>{MODERATION_DISCLAIMER_COPY}</p>
        </section>

        <section className={styles.section} aria-labelledby="retention-policy-heading">
          <h2 id="retention-policy-heading">Retention</h2>
          <ul className={styles.plainList}>
            <li>Rejected original submissions are deleted 90 days after the rejection decision.</li>
            <li>Expired abuse-prevention records are deleted after 24 hours.</li>
            <li>
              Approved, published records are retained until withdrawn (see &ldquo;Requesting
              removal&rdquo; below) or superseded by a later moderation decision.
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="requesting-removal-heading">
          <h2 id="requesting-removal-heading">Requesting removal</h2>
          <p className={styles.prose}>{REMOVAL_CONTACT_COPY}</p>
          <p className={styles.prose}>
            Once a request is confirmed to match a published record, it is removed from public
            view immediately, or deleted outright if that is what was requested. There is no
            automated self-service removal in this version — a real production deployment would
            replace this placeholder with a monitored inbox or a lightweight removal-request form.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="out-of-scope-heading">
          <h2 id="out-of-scope-heading">What&apos;s explicitly out of scope</h2>
          <ul className={styles.plainList}>
            <li>Authentication, accounts, or profiles for submitters or moderators.</li>
            <li>A public-facing moderation panel or dashboard.</li>
            <li>Automatically publishing a submission without moderation.</li>
            <li>
              Forwarding a submission to a government department, or treating it as a
              grievance-resolution channel.
            </li>
            <li>Third-party analytics on submission form pages or payloads.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
