import { parse } from 'csv-parse/sync';
import { AppError } from '../../plugins/errors.js';

export interface CsvContent {
  header: string[];
  /** Data rows as raw strings (no numeric conversion); the header is excluded. */
  records: string[][];
}

/**
 * Picks the delimiter from the header line alone: a tab means TSV; a `;` with no `,` means a
 * semicolon file (Brazilian exports); anything else keeps the comma, so the Nubank files read
 * exactly as before.
 */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0] ?? '';
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';') && !firstLine.includes(',')) return ';';
  return ',';
}

/**
 * Reads delimited text (comma, semicolon or tab, see `detectDelimiter`) into a header and raw
 * records. Strips a UTF-8 BOM, accepts `\n` and `\r\n`,
 * keeps quoted fields (commas inside quotes included) and skips blank lines. A row with a
 * different number of columns is kept as is so a parser can mark it `invalid` instead of the
 * whole file failing. Empty input or a header without rows raises `empty_file`; text that is
 * not parseable as CSV (e.g. an unterminated quote) raises `unsupported_format`.
 */
export function readCsv(text: string): CsvContent {
  let all: string[][];
  try {
    all = parse(text, {
      bom: true,
      delimiter: detectDelimiter(text),
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: false,
    }) as string[][];
  } catch {
    throw new AppError('unsupported_format', 422, 'The file is not a valid CSV');
  }
  const [header, ...records] = all;
  if (header === undefined || records.length === 0) {
    throw new AppError('empty_file', 422, 'The file has no rows to import');
  }
  return { header, records };
}
