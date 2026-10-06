import { AppError } from '../../plugins/errors.js';

const AMOUNT = /^(\d{1,12})(?:\.(\d{1,2}))?$/;

/**
 * AD-004: validates a monetary amount and returns it in canonical form, always with 2 decimals
 * and no leading zeros (`"10"` becomes `"10.00"`, `"7.5"` becomes `"7.50"`). Works on the string
 * only, so no float is involved. Input is not trimmed: surrounding spaces are invalid.
 * Accepts up to 12 integer digits and 2 decimals (fits `numeric(14,2)`), strictly greater than zero.
 * Anything that is not a string (a JSON number, boolean, null, object) is invalid: the request
 * schema does not coerce `amount`, so a number never reaches here as a string.
 */
export function parseAmount(value: unknown): string {
  if (typeof value !== 'string') throw invalidAmount();
  const match = AMOUNT.exec(value);
  if (!match) throw invalidAmount();
  const integer = (match[1] as string).replace(/^0+(?=\d)/, '');
  const decimals = (match[2] ?? '').padEnd(2, '0');
  if (/^0+$/.test(integer + decimals)) throw invalidAmount();
  return `${integer}.${decimals}`;
}

function invalidAmount(): AppError {
  return new AppError(
    'invalid_amount',
    422,
    'Amount must be greater than zero, with up to 12 integer digits and 2 decimals',
    'amount',
  );
}

/**
 * Accepts only absolute `http`/`https` URLs, parsed with the WHATWG `URL` parser, and returns
 * the input unchanged. Anything else (plain text, `javascript:`, `ftp:`, relative paths) is rejected.
 */
export function parseReceiptUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidReceipt();
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') {
    throw invalidReceipt();
  }
  return value;
}

function invalidReceipt(): AppError {
  return new AppError('invalid_receipt_url', 422, 'Receipt must be a valid http or https URL', 'receipt');
}
