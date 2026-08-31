/**
 * Minimal RFC 4180-style CSV parser: quoted fields, embedded commas inside
 * quotes, escaped quotes (`""` -> `"`), and both `\n` and `\r\n` line
 * endings. Pure function, no dependency added for this session's small,
 * simple seed CSV fixture format (columns: name, url, department, notes —
 * see `data/seed/assam-directory-example.csv`).
 *
 * Returns an array of rows, each row an array of field strings. The
 * caller (`adapters/csv.ts`) is responsible for treating the first row as
 * a header.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < n) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      // Consume; a following \n (if any) triggers the row push below.
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Final field/row, unless the file ended cleanly on a newline (in which
  // case there is nothing pending to flush).
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
