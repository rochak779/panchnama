/**
 * Typed, non-crashing errors for this package. `createDbClient` itself
 * never throws on a failed connection until a query is actually attempted;
 * callers (this session's CLI scripts, and Session 10's future API routes)
 * should catch these and return a graceful/typed failure rather than let
 * the process crash — implementation.md section 9.8: "If the database is
 * unavailable, the audit scorecard remains readable."
 */

export class UnknownPortalIdError extends Error {
  constructor(public readonly portalId: string) {
    super(`portalId "${portalId}" is not a known published portal id.`);
    this.name = "UnknownPortalIdError";
  }
}

export class SubmissionNotFoundError extends Error {
  constructor(public readonly submissionId: string) {
    super(`No submission found with id "${submissionId}".`);
    this.name = "SubmissionNotFoundError";
  }
}

export class InvalidModerationDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidModerationDecisionError";
  }
}

export class DatabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The database is currently unavailable.");
    this.name = "DatabaseUnavailableError";
    this.cause = cause;
  }
}
