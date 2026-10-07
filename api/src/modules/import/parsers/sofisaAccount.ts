import { readCsv } from '../csv.js';
import { collapseSpaces } from '../../../lib/normalize.js';
import type { ParsedRow, ParseResult } from '../types.js';
import { canonicalAmount, invalidRow, localDateOf } from './common.js';
import { originalText } from './descriptions.js';
import { describeSofisa, isBalanceLine } from './sofisaDescriptions.js';

/** CSV header (`;`); the TSV export carries an extra empty column, see `SOFISA_ACCOUNT_TSV_HEADER`. */
export const SOFISA_ACCOUNT_HEADER = ['Data', 'Descrição', 'Valor'];
export const SOFISA_ACCOUNT_TSV_HEADER = ['Data', 'Descrição', '', 'Valor'];

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** `-R$ 0,23`, `R$ 1.350,00`, `R$ -5,00`: optional sign before or after `R$`, dot thousands, decimal comma. */
const MONEY = /^(-)?\s*(?:R\$)?\s*(-)?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/;

function parseDate(value: string): string | null {
  const match = DATE.exec(value);
  return match ? localDateOf(match[3] as string, match[2] as string, match[1] as string) : null;
}

/** Sign and canonical absolute amount from the BRL text (strings only, no float); null if malformed or zero. */
function parseMoney(value: string): { type: 'Income' | 'Expense'; amount: string } | null {
  const match = MONEY.exec(value.trim());
  if (!match || (match[1] !== undefined && match[2] !== undefined)) return null;
  const amount = canonicalAmount((match[3] as string).replace(/\./g, ''), match[4] as string);
  if (amount === null) return null;
  return { type: match[1] !== undefined || match[2] !== undefined ? 'Expense' : 'Income', amount };
}

/** A TSV row has an empty third column in every line: it is dropped so both exports share one shape. */
function normalize(record: string[]): string[] {
  if (record.length !== 4 || (record[2] ?? '').trim() !== '') return record;
  return [record[0] as string, record[1] as string, record[3] as string];
}

/**
 * Parses the Sofisa Direto account statement (`Data;Descrição;Valor`, or the 4-column TSV variant).
 * There is no identifier, so duplicates are found by content later. `Saldo em dd/mm/aaaa` rows are
 * `ignored`. A malformed row becomes `invalid` with a reason; it never aborts the file.
 */
export function parseSofisaAccount(text: string): ParseResult {
  const { records } = readCsv(text);
  return { rows: records.map((record, index) => parseRecord(normalize(record), index)) };
}

function parseRecord(record: string[], index: number): ParsedRow {
  if (record.length !== SOFISA_ACCOUNT_HEADER.length) {
    return invalidRow(index, `Expected ${SOFISA_ACCOUNT_HEADER.length} columns, found ${record.length}`);
  }
  const [rawDate, description, rawAmount] = record as [string, string, string];
  const raw = { name: collapseSpaces(description), description: originalText(description) };

  const localDate = parseDate(rawDate.trim());
  if (localDate === null) return invalidRow(index, `Invalid date "${rawDate}"`, raw);
  // `transactions.name` cannot be blank: an empty description would fail the whole import at insert.
  if (description.trim() === '') return invalidRow(index, 'Empty description', { localDate, ...raw });

  const parsed = parseMoney(rawAmount);
  if (isBalanceLine(description)) {
    return {
      ...invalidRow(index, 'Daily balance line, not a transaction', { localDate, ...raw, ...parsed }),
      status: 'ignored',
      identifier: null,
    };
  }
  if (parsed === null) return invalidRow(index, `Invalid or zero amount "${rawAmount}"`, { localDate, ...raw });
  return {
    index,
    localDate,
    type: parsed.type,
    amount: parsed.amount,
    identifier: null,
    description: originalText(description),
    ...describeSofisa(description),
  };
}
