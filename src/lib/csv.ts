/**
 * CSV building. Hand-rolled deliberately — AGENTS.md rules out new dependencies,
 * and the only genuinely hard part here is a security concern no CSV library
 * solves by default anyway (see `escapeCsvCell`).
 */

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than text.
 * Group names and custom-activity names are user-authored free text, so a member
 * can name an activity `=1+1` — or, far worse, something that exfiltrates data
 * when a groupmate opens the export in Excel or Sheets. Prefixing with an
 * apostrophe is the standard neutralisation: spreadsheets render the value as
 * literal text and the leading quote is not shown.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  let text = String(value)

  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`
  }

  // RFC 4180: wrap in quotes when the value contains a delimiter, quote or
  // newline, and double any embedded quote.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  const lines = [headers.map(escapeCsvCell).join(',')]

  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','))
  }

  // CRLF per RFC 4180, and a trailing newline so the last row is terminated.
  return `${lines.join('\r\n')}\r\n`
}

/**
 * Excel decides a CSV's encoding from a byte-order mark. Without one it reads
 * UTF-8 as the local ANSI codepage, which mangles every emoji in a custom
 * activity name (and PushUS activity names are emoji-heavy by design).
 */
const BOM = String.fromCharCode(0xfeff)

export function csvBlob(csv: string): Blob {
  return new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
}
