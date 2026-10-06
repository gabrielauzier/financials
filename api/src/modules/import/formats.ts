import { AppError } from '../../plugins/errors.js';
import { readCsv } from './csv.js';
import { NUBANK_ACCOUNT_HEADER, parseNubankAccount } from './parsers/nubankAccount.js';
import { NUBANK_INVOICE_HEADER, parseNubankInvoice } from './parsers/nubankInvoice.js';
import type { ParsedRow, Parser } from './types.js';

export type ImportFormat = 'nubankAccount' | 'nubankInvoice';

/** Account banks (`accounts.bank`): `Nubank | SofisaDireto | Neon | XP | Other`. */
export type Bank = string;

const PARSERS: Record<ImportFormat, Parser> = {
  nubankAccount: parseNubankAccount,
  nubankInvoice: parseNubankInvoice,
};

const HEADERS: Record<ImportFormat, readonly string[]> = {
  nubankAccount: NUBANK_ACCOUNT_HEADER,
  nubankInvoice: NUBANK_INVOICE_HEADER,
};

/** Both supported formats are Nubank exports; other banks have no parser yet. */
const BANK_OF: Record<ImportFormat, Bank> = { nubankAccount: 'Nubank', nubankInvoice: 'Nubank' };

/** Exact, case-sensitive header match (a BOM is already stripped by `readCsv`); null if unknown. */
export function detectFormat(header: string[]): ImportFormat | null {
  for (const format of Object.keys(HEADERS) as ImportFormat[]) {
    const expected = HEADERS[format];
    if (header.length === expected.length && header.every((cell, i) => cell === expected[i])) {
      return format;
    }
  }
  return null;
}

/** Throws `bank_mismatch` (422) when the format does not belong to the account's bank. */
export function assertBankMatches(format: ImportFormat, bank: Bank): void {
  if (BANK_OF[format] !== bank) {
    throw new AppError('bank_mismatch', 422, `A ${BANK_OF[format]} file cannot be imported into a ${bank} account`);
  }
}

export function parseByFormat(format: ImportFormat, text: string): { rows: ParsedRow[] } {
  return PARSERS[format](text);
}

/**
 * Full pre-classification pipeline: reads the header, detects the format (`unsupported_format`
 * when unknown), checks it against the account bank (`bank_mismatch`) and parses. An empty or
 * header-only file raises `empty_file` first.
 */
export function parseImport(text: string, bank: Bank): { format: ImportFormat; rows: ParsedRow[] } {
  const { header } = readCsv(text);
  const format = detectFormat(header);
  if (format === null) {
    throw new AppError('unsupported_format', 422, 'The CSV header is not a supported Nubank format');
  }
  assertBankMatches(format, bank);
  return { format, rows: parseByFormat(format, text).rows };
}
