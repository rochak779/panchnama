import { parseCsv } from "../csv.js";
import type { AdapterResult, PortalCandidateReference, RejectedCandidate } from "../candidate.js";

export interface CsvAdapterContext {
  sourceId: string;
  discoveredFromUrl: string;
  discoveryMethod: "listed" | "outbound_link" | "manual";
}

const RECOGNIZED_COLUMNS = new Set(["name", "url", "department", "notes"]);

/**
 * CSV seed adapter — implementation.md section 14 Session 3: "parse a
 * simple CSV seed file (columns: name, url, department, notes or
 * similar) into candidates."
 *
 * The first row is treated as a header naming columns (case-insensitive,
 * order-independent). `name` and `url` are required columns; `department`
 * and `notes` are optional and recognized when present. Unrecognized
 * extra columns are ignored rather than rejected (matches the doc's "or
 * similar" — this session doesn't try to guess every possible column
 * name). Rows missing a usable `name` or `url` are rejected rather than
 * silently dropped.
 */
export function parseCsvSeed(csvText: string, context: CsvAdapterContext): AdapterResult {
  const candidates: PortalCandidateReference[] = [];
  const rejected: RejectedCandidate[] = [];

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { candidates, rejected };
  }

  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const nameIndex = header.indexOf("name");
  const urlIndex = header.indexOf("url");
  const departmentIndex = header.indexOf("department");
  const notesIndex = header.indexOf("notes");

  if (nameIndex === -1 || urlIndex === -1) {
    rejected.push({
      sourceId: context.sourceId,
      raw: { header },
      reason: "CSV header is missing a required 'name' or 'url' column",
    });
    return { candidates, rejected };
  }

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const rawEntry: Record<string, unknown> = {};
    for (const [colIndex, colName] of header.entries()) {
      if (RECOGNIZED_COLUMNS.has(colName)) {
        rawEntry[colName] = row[colIndex] ?? "";
      }
    }

    const name = (row[nameIndex] ?? "").trim();
    const url = (row[urlIndex] ?? "").trim();

    if (name.length === 0 || url.length === 0) {
      rejected.push({
        sourceId: context.sourceId,
        raw: rawEntry,
        reason: name.length === 0 ? "row missing a usable 'name'" : "row missing a usable 'url'",
      });
      continue;
    }

    const candidate: PortalCandidateReference = {
      name,
      url,
      discoveredFromUrl: context.discoveredFromUrl,
      discoveryMethod: context.discoveryMethod,
      sourceId: context.sourceId,
    };
    if (departmentIndex !== -1) {
      const department = (row[departmentIndex] ?? "").trim();
      if (department.length > 0) {
        candidate.department = department;
      }
    }
    if (notesIndex !== -1) {
      const notes = (row[notesIndex] ?? "").trim();
      if (notes.length > 0) {
        candidate.notes = notes;
      }
    }

    candidates.push(candidate);
  }

  return { candidates, rejected };
}
