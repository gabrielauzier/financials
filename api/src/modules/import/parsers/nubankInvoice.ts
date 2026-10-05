import { readCsv } from '../csv.js';
import type { ParsedRow, ParseResult } from '../types.js';
import { canonicalAmount, invalidRow, localDateOf } from './common.js';

export const NUBANK_INVOICE_HEADER = ['date', 'title', 'amount'];

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Brazilian amount: optional `-` (a space may follow it), thousands `.` and decimal `,`. */
const BR_AMOUNT = /^(-)?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/;

function parseDate(value: string): string | null {
  const match = DATE.exec(value);
  return match ? localDateOf(match[1] as string, match[2] as string, match[3] as string) : null;
}

/** `"- 1.335,61"` becomes `{ negative: true, amount: "1335.61" }`; strings only, no float. */
function parseBrazilianAmount(value: string): { negative: boolean; amount: string } | null {
  const match = BR_AMOUNT.exec(value);
  if (!match) return null;
  const amount = canonicalAmount((match[2] as string).replaceAll('.', ''), match[3] as string);
  return amount === null ? null : { negative: match[1] === '-', amount };
}

/**
 * Parses the Nubank card invoice (`date,title,amount`). A positive amount is an `Expense` on the
 * `CreditCard`; a negative one (e.g. `Pagamento recebido`) is `ignored`: not importable, but
 * still listed with its index and absolute amount (typed `Income` as it is a credit on the card).
 * `identifier` is always null. A malformed row becomes `invalid` with a reason.
 */
export function parseNubankInvoice(text: string): ParseResult {
  const { records } = readCsv(text);
  return { rows: records.map((record, index) => parseRecord(record, index)) };
}

function parseRecord(record: string[], index: number): ParsedRow {
  if (record.length !== NUBANK_INVOICE_HEADER.length) {
    return invalidRow(index, `Expected ${NUBANK_INVOICE_HEADER.length} columns, found ${record.length}`, {
      paymentMethod: 'CreditCard',
    });
  }
  const [rawDate, title, rawAmount] = record as [string, string, string];
  const base = { name: title, paymentMethod: 'CreditCard' } as const;

  const localDate = parseDate(rawDate.trim());
  if (localDate === null) return invalidRow(index, `Invalid date "${rawDate}"`, base);

  const parsed = parseBrazilianAmount(rawAmount.trim());
  if (parsed === null) {
    return invalidRow(index, `Invalid or zero amount "${rawAmount}"`, { ...base, localDate });
  }
  const row: ParsedRow = {
    index,
    localDate,
    type: parsed.negative ? 'Income' : 'Expense',
    amount: parsed.amount,
    name: title,
    paymentMethod: 'CreditCard',
    categoryKey: 'Uncategorized',
    identifier: null,
    counterpartyDocument: null,
    counterpartyBank: null,
    status: parsed.negative ? 'ignored' : 'new',
  };
  if (parsed.negative) row.reason = 'Credit on the invoice (e.g. payment received) is not imported';
  return row;
}
