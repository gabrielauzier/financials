import { DateTime } from 'luxon';
import { AppError } from '../../plugins/errors.js';

const SIGNED_AMOUNT = /^(-)?(\d{1,12})(?:\.(\d{1,2}))?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Signed variant of the transaction amount parser: a decimal string with an optional leading `-`,
 * up to 12 integer digits and 2 decimals, never zero (`"0"`, `"0.00"` and `"-0.00"` are invalid).
 * Returns the canonical form with 2 decimals (`"-7.5"` becomes `"-7.50"`). Works on the string
 * only, so no float is involved. Non-strings (a JSON number, null...) are invalid. `+` is not accepted.
 */
export function parseSignedAmount(value: unknown): string {
  if (typeof value !== 'string') throw invalidAmount();
  const match = SIGNED_AMOUNT.exec(value);
  if (!match) throw invalidAmount();
  const integer = (match[2] as string).replace(/^0+(?=\d)/, '');
  const decimals = (match[3] ?? '').padEnd(2, '0');
  if (/^0+$/.test(integer + decimals)) throw invalidAmount();
  return `${match[1] ?? ''}${integer}.${decimals}`;
}

function invalidAmount(): AppError {
  return new AppError(
    'invalid_amount',
    422,
    'Amount must be a non-zero decimal, positive or negative, with up to 12 integer digits and 2 decimals',
    'amount',
  );
}

/** `occurredOn`: a real calendar date written `YYYY-MM-DD` (`2026-02-30` is invalid). */
export function parseDate(value: unknown): string {
  if (typeof value !== 'string' || !DATE.test(value) || !DateTime.fromISO(value, { zone: 'utc' }).isValid) {
    throw new AppError('invalid_date', 422, 'occurredOn must be a valid date in the format YYYY-MM-DD', 'occurredOn');
  }
  return value;
}
