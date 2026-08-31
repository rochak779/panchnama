import { z } from "zod";
import { httpUrlString, nonEmptyString, schemaVersionField, stableId } from "./common.js";

/**
 * `config/crawl-policy.yaml` schema — implementation.md section 6 in full.
 * Section numbers below reference the subsections that motivate each block.
 */

/** 6.1 Default boundaries. */
const boundariesSchema = z
  .object({
    maxPagesPerPortal: z.number().int().positive(),
    maxDepth: z.number().int().min(0),
    maxConcurrentRequestsPerHost: z.number().int().positive(),
    minDelayMsPerHost: z.number().int().min(0),
    requestTimeoutMs: z.number().int().positive(),
    maxAttemptsAvailabilityCritical: z.number().int().positive(),
    maxResponseBodyBytes: z.number().int().positive(),
    maxRedirects: z.number().int().min(0).max(50, "maxRedirects must stay within a sane ceiling"),
    allowedSchemes: z
      .array(z.enum(["http", "https"]))
      .min(1)
      .refine((schemes) => new Set(schemes).size === schemes.length, {
        message: "allowedSchemes must not contain duplicates",
      }),
  })
  .strict();

/** 6.2 Exclusions. */
const exclusionsSchema = z
  .object({
    routeCategories: z.array(nonEmptyString).default([]),
    denylistPathPatterns: z.array(nonEmptyString).default([]),
    excludedUrlSchemes: z.array(nonEmptyString).default([]),
  })
  .strict();

/** 6.3 Robots and identification. */
const robotsAndIdentificationSchema = z
  .object({
    userAgent: nonEmptyString,
    contactUrl: httpUrlString,
    respectRobotsTxt: z.boolean(),
  })
  .strict();

/** 6.4 JavaScript rendering. */
const jsRenderingSchema = z
  .object({
    browserFallbackEnabled: z.boolean(),
    perPortalAllowlist: z.array(stableId).default([]),
    maxBrowserPagesPerPortal: z.number().int().positive(),
    maxBrowserResourceBytes: z.number().int().positive(),
  })
  .strict();

/** 6.5 URL normalization. */
const urlNormalizationSchema = z
  .object({
    trailingSlashPolicy: z.enum(["strip", "preserve"]),
    removeFragments: z.boolean(),
    trackingParameterDenylist: z.array(nonEmptyString).default([]),
    sortRetainedQueryParameters: z.boolean(),
  })
  .strict();

/** 6.6 Safe operation. */
const safeOperationSchema = z
  .object({
    globalKillSwitch: z.boolean(),
    disabledDomains: z.array(nonEmptyString).default([]),
    allowedHttpMethods: z
      .array(z.enum(["GET", "HEAD"]))
      .min(1, "at least GET must be allowed; forms are never submitted"),
  })
  .strict();

export const crawlPolicyConfigSchema = z
  .object({
    schemaVersion: schemaVersionField,
    boundaries: boundariesSchema,
    exclusions: exclusionsSchema,
    robotsAndIdentification: robotsAndIdentificationSchema,
    jsRendering: jsRenderingSchema,
    urlNormalization: urlNormalizationSchema,
    safeOperation: safeOperationSchema,
  })
  .strict();

export type CrawlPolicyConfig = z.infer<typeof crawlPolicyConfigSchema>;
