import { z } from "zod";
import { experienceSubmissionSchema } from "@panchnama/schema";
import { TASK_TYPE_OPTIONS } from "./experienceOptions";

/**
 * Request-body schema for `POST /api/experiences`.
 *
 * Derivation choice: `.pick()` from `@panchnama/schema`'s
 * `experienceSubmissionSchema` (Session 1's shared stored-record schema)
 * for every field a citizen actually supplies, rather than hand-writing a
 * fully separate schema. This keeps the length caps (`taskDescription`
 * <=280, `freeText` <=1000), the `stableId`/enum/rating shapes, and any
 * future change to those bounds in exactly one place — `packages/schema`
 * — instead of two schemas that could silently drift apart. `taskType` is
 * `.pick()`-ed too but then narrowed further with `.extend()` from
 * `nonEmptyString` to this session's own controlled `TASK_TYPE_OPTIONS`
 * enum (see `experienceOptions.ts`), since the shared schema deliberately
 * left `taskType` open pending a controlled vocabulary this session
 * defines.
 *
 * Fields the client must NOT be able to set are simply never picked:
 * `id`, `schemaVersion`, `createdAt`, `status`, `moderatedAt`,
 * `moderationReasonCode`, `publicText`, `privacyFlags`, `duplicateOf`, and
 * `source` (the public route always assigns `source: "public_form"`
 * server-side — `research_interview` is not a value the public API ever
 * accepts, since it describes a different, non-public intake path) are all
 * server-assigned. `.strict()` (inherited from `.pick()`) rejects any
 * extra field a caller tries to smuggle in, so a client cannot bypass this
 * by simply including `status: "approved"` in the request body.
 *
 * Honeypot field: `website` — a decoy field named to resemble a normal
 * "your organization's website" input, which spam bots that auto-fill
 * every visible-looking field tend to populate, but which a real citizen
 * using an accessible form never sees or fills (Session 11+'s form is
 * expected to render it visually hidden with `aria-hidden`/off-screen
 * positioning and no visible label, and never let a human autofill agent
 * reach it via tab order). Optional; must be empty/absent on a legitimate
 * request.
 */
export const HONEYPOT_FIELD_NAME = "website" as const;

export const experienceRequestSchema = experienceSubmissionSchema
  .pick({
    portalId: true,
    occurredOn: true,
    taskDescription: true,
    outcome: true,
    themes: true,
    deviceType: true,
    experienceRating: true,
    freeText: true,
    consentToPublish: true,
  })
  .extend({
    taskType: z.enum(TASK_TYPE_OPTIONS),
    [HONEYPOT_FIELD_NAME]: z.string().max(200).optional(),
  })
  .strict();

export type ExperienceRequestBody = z.infer<typeof experienceRequestSchema>;
