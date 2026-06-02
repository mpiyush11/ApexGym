/**
 * CSV helpers with injection protection.
 *
 * Spreadsheet apps execute a cell that starts with = + - @ (and sometimes tab /
 * carriage return) as a formula. We neutralize that by prefixing a single quote
 * so the value is treated as text. Also RFC-4180 quote/escape.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Injection guard: neutralize leading formula triggers.
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  // RFC-4180 quoting when the value contains comma, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}
