import type { ParsedRow } from '../types.js';

/** `year`, `month`, `day` form a real calendar date (rejects 31/02, month 13, ...). */
export function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Returns `YYYY-MM-DD` or null when `year-month-day` is not a real date. */
export function localDateOf(year: string, month: string, day: string): string | null {
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) return null;
  if (!isRealDate(Number(year), Number(month), Number(day))) return null;
  return `${year}-${month}-${day}`;
}

const MAX_INTEGER_DIGITS = 12;

/**
 * AD-004: builds the canonical amount string (no leading zeros, exactly 2 decimals) from digit
 * strings, with no float involved. Returns null for more than 2 decimals, more than 12 integer
 * digits (does not fit `numeric(14,2)`) or a zero amount.
 */
export function canonicalAmount(integer: string, decimals: string): string | null {
  if (!/^\d+$/.test(integer) || !/^\d*$/.test(decimals)) return null;
  if (decimals.length > 2) return null;
  const whole = integer.replace(/^0+(?=\d)/, '');
  if (whole.length > MAX_INTEGER_DIGITS) return null;
  const cents = decimals.padEnd(2, '0');
  if (/^0+$/.test(whole + cents)) return null;
  return `${whole}.${cents}`;
}

/**
 * Placeholder row for a malformed line: the file is never aborted, the row is listed as `invalid`
 * with a reason. The data fields hold neutral placeholders and are never imported.
 */
export function invalidRow(index: number, reason: string, patch: Partial<ParsedRow> = {}): ParsedRow {
  return {
    index,
    localDate: '',
    type: 'Expense',
    amount: '0.00',
    name: '',
    paymentMethod: 'BankTransfer',
    categoryKey: 'Uncategorized',
    identifier: null,
    counterpartyDocument: null,
    counterpartyBank: null,
    ...patch,
    status: 'invalid',
    reason,
  };
}
