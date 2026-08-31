/**
 * CSV export helpers — implementation.md section 12.1: "Prevent
 * spreadsheet formula injection in CSV fields beginning with `=`, `+`,
 * `-`, or `@`." and section 10.8: "CSV fields should remain
 * analysis-friendly. Arrays should either be flattened deliberately or
 * excluded in favor of counts and canonical URLs."
 *
 * Formula-injection mitigation: a field whose value (after coercion to a
 * string) begins with `=`, `+`, `-`, or `@` is prefixed with a leading
 * single quote (`'`) BEFORE normal CSV quoting is applied. This is the
 * standard mitigation used by OWASP's CSV-injection guidance — it forces
 * spreadsheet applications (Excel, Google Sheets, LibreOffice Calc) to
 * treat the cell as literal text rather than evaluating it as a formula,
 * while remaining valid, losslessly round-trippable CSV (the leading `'`
 * is visible in the raw file, which is an acceptable, well-understood
 * trade-off for safety over cosmetic purity).
 */
const FORMULA_INJECTION_PREFIXES = ["=", "+", "-", "@"];

export function neutralizeFormulaInjection(value: string): string {
  if (value.length > 0 && FORMULA_INJECTION_PREFIXES.includes(value[0]!)) {
    return `'${value}`;
  }
  return value;
}

/** RFC 4180-style field escaping: wrap in double quotes and double any
 * embedded quotes whenever the field contains a comma, quote, or newline
 * (CR or LF). */
function escapeCsvField(value: string): string {
  const needsQuoting = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

/** Full pipeline for one CSV cell value: stringify, neutralize formula
 * injection, then RFC 4180 escape. Order matters — neutralization must
 * happen before quoting so a leading `'` ends up inside the quotes, not
 * outside them. */
export function csvCell(value: string | number | boolean | undefined | null): string {
  const str = value === undefined || value === null ? "" : String(value);
  return escapeCsvField(neutralizeFormulaInjection(str));
}

export function buildCsv(
  headers: string[],
  rows: (string | number | boolean | undefined | null)[][],
): string {
  const lines = [headers.map((h) => csvCell(h)).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => csvCell(cell)).join(","));
  }
  // CRLF line endings per RFC 4180; trailing newline for POSIX-friendly files.
  return lines.join("\r\n") + "\r\n";
}
