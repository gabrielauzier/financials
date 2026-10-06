import { AppError } from '../../plugins/errors.js';
import { parseAmount } from '../transactions/validation.js';

const ZERO = /^0+(?:\.0{1,2})?$/;

/** `totalAmount`: a decimal string > 0 (same rules as a transaction amount), error field `totalAmount`. */
export function parseTotalAmount(value: unknown): string {
  try {
    return parseAmount(value);
  } catch {
    throw new AppError(
      'invalid_amount',
      422,
      'totalAmount must be a decimal string greater than zero, with up to 12 integer digits and 2 decimals',
      'totalAmount',
    );
  }
}

/**
 * `paidAmount`: a decimal string >= 0 in canonical form (`"0"` becomes `"0.00"`). Zero is valid
 * here, unlike `parseAmount`; everything else follows it. Not a string (JSON number, null...) is invalid.
 */
export function parsePaidAmount(value: unknown): string {
  if (typeof value === 'string' && ZERO.test(value)) return '0.00';
  try {
    return parseAmount(value);
  } catch {
    throw invalidPaid('paidAmount must be a decimal string of 0 or more, with up to 12 integer digits and 2 decimals');
  }
}

/** Whole cents of a canonical 2-decimal amount string, so amounts compare without any float. */
function cents(amount: string): bigint {
  return BigInt(amount.replace('.', ''));
}

/** Rejects a paid amount above the total (both canonical 2-decimal strings). */
export function assertPaidWithinTotal(paid: string, total: string): void {
  if (cents(paid) > cents(total)) throw invalidPaid('paidAmount must not be greater than totalAmount');
}

function invalidPaid(message: string): AppError {
  return new AppError('invalid_paid_amount', 422, message, 'paidAmount');
}

/** `recurrencyDay`: a JSON integer from 1 to 31. A string such as `"5"` or a fraction is invalid. */
export function parseRecurrencyDay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 31) {
    throw new AppError('invalid_day', 422, 'recurrencyDay must be an integer from 1 to 31', 'recurrencyDay');
  }
  return value;
}
