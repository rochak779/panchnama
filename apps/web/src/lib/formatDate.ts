/**
 * Formats an ISO timestamp as a plain, unambiguous English date (e.g. "15
 * September 2026") — implementation.md section 10.9's "use plain English"
 * requirement, and deliberately not a numeric `DD/MM/YYYY` or `MM/DD/YYYY`
 * form, which reads ambiguously to a mixed Indian/international audience.
 */
export function formatAuditDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
