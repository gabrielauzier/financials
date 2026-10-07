import { AppError } from '../../plugins/errors.js';
import { readCsv } from './csv.js';
import { NOTION_HEADER, parseNotion } from './parsers/notion.js';
import { NUBANK_ACCOUNT_HEADER, parseNubankAccount } from './parsers/nubankAccount.js';
import { NUBANK_INVOICE_HEADER, parseNubankInvoice } from './parsers/nubankInvoice.js';
import { parseSofisaAccount, SOFISA_ACCOUNT_HEADER, SOFISA_ACCOUNT_TSV_HEADER } from './parsers/sofisaAccount.js';
import type { ParsedRow, Parser } from './types.js';

export type ImportFormat = 'nubankAccount' | 'nubankInvoice' | 'sofisaAccount' | 'notion';

/** Account banks (`accounts.bank`): `Nubank | SofisaDireto | Neon | XP | Other`. */
export type Bank = string;

const PARSERS: Record<ImportFormat, Parser> = {
  nubankAccount: parseNubankAccount,
  nubankInvoice: parseNubankInvoice,
  sofisaAccount: parseSofisaAccount,
  notion: parseNotion,
};

/** Accepted headers per format; the Sofisa TSV export has an extra empty column. */
const HEADERS: Record<ImportFormat, readonly (readonly string[])[]> = {
  nubankAccount: [NUBANK_ACCOUNT_HEADER],
  nubankInvoice: [NUBANK_INVOICE_HEADER],
  sofisaAccount: [SOFISA_ACCOUNT_HEADER, SOFISA_ACCOUNT_TSV_HEADER],
  notion: [NOTION_HEADER],
};

/**
 * The account bank each format belongs to; Neon and XP have no parser yet. `null` means the
 * format is not bank-specific (the Notion model) and any active account accepts it.
 */
const BANK_OF: Record<ImportFormat, Bank | null> = {
  nubankAccount: 'Nubank',
  nubankInvoice: 'Nubank',
  sofisaAccount: 'SofisaDireto',
  notion: null,
};

/** Exact, case-sensitive header match (a BOM is already stripped by `readCsv`); null if unknown. */
export function detectFormat(header: string[]): ImportFormat | null {
  for (const format of Object.keys(HEADERS) as ImportFormat[]) {
    for (const expected of HEADERS[format]) {
      if (header.length === expected.length && header.every((cell, i) => cell === expected[i])) {
        return format;
      }
    }
  }
  return null;
}

/** Throws `bank_mismatch` (422) when the format belongs to a bank other than the account's (the Notion format belongs to none). */
export function assertBankMatches(format: ImportFormat, bank: Bank): void {
  const expected = BANK_OF[format];
  if (expected !== null && expected !== bank) {
    throw new AppError('bank_mismatch', 422, `A ${expected} file cannot be imported into a ${bank} account`);
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
    throw new AppError('unsupported_format', 422, 'The file header is not a supported format (Nubank account or invoice, Sofisa Direto account, Notion transactions)');
  }
  assertBankMatches(format, bank);
  return { format, rows: parseByFormat(format, text).rows };
}
