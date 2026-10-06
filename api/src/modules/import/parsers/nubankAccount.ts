import { readCsv } from '../csv.js';
import type { ParsedRow, ParseResult } from '../types.js';
import { canonicalAmount, invalidRow, localDateOf } from './common.js';
import { describeStatement, originalText } from './descriptions.js';

export const NUBANK_ACCOUNT_HEADER = ['Data', 'Valor', 'Identificador', 'Descrição'];

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const SIGNED_AMOUNT = /^(-)?(\d+)(?:\.(\d*))?$/;

/** Parses `dd/mm/aaaa` into `YYYY-MM-DD`, or null when malformed or not a real date. */
function parseDate(value: string): string | null {
  const match = DATE.exec(value);
  return match ? localDateOf(match[3] as string, match[2] as string, match[1] as string) : null;
}

/** Parses `-82.32` / `8608.00` into the sign and the canonical absolute amount (strings only). */
function parseSignedAmount(value: string): { type: 'Income' | 'Expense'; amount: string } | null {
  const match = SIGNED_AMOUNT.exec(value);
  if (!match) return null;
  const amount = canonicalAmount(match[2] as string, match[3] ?? '');
  if (amount === null) return null;
  return { type: match[1] === '-' ? 'Expense' : 'Income', amount };
}

/**
 * Parses the Nubank account statement (`Data,Valor,Identificador,Descrição`). `index` is the
 * 0-based position of the data row, header excluded. A malformed row becomes `invalid` with a
 * reason; it never aborts the file.
 */
export function parseNubankAccount(text: string): ParseResult {
  const { records } = readCsv(text);
  return { rows: records.map((record, index) => parseRecord(record, index)) };
}

function parseRecord(record: string[], index: number): ParsedRow {
  if (record.length !== NUBANK_ACCOUNT_HEADER.length) {
    return invalidRow(index, `Expected ${NUBANK_ACCOUNT_HEADER.length} columns, found ${record.length}`);
  }
  const [rawDate, rawAmount, rawIdentifier, description] = record as [string, string, string, string];
  const identifier = rawIdentifier.trim() === '' ? null : rawIdentifier.trim();
  // What an invalid row still carries (it is listed, never imported).
  const raw = { identifier, name: description, description: originalText(description) };

  const localDate = parseDate(rawDate.trim());
  if (localDate === null) {
    return invalidRow(index, `Invalid date "${rawDate}"`, raw);
  }
  const parsed = parseSignedAmount(rawAmount.trim());
  if (parsed === null) {
    return invalidRow(index, `Invalid or zero amount "${rawAmount}"`, { localDate, ...raw });
  }
  // `transactions.name` cannot be blank: an empty description would fail the whole import at insert.
  if (description.trim() === '') {
    return invalidRow(index, 'Empty description', { localDate, ...raw });
  }
  return {
    index,
    localDate,
    type: parsed.type,
    amount: parsed.amount,
    identifier,
    description: originalText(description),
    ...describeStatement(description),
  };
}
