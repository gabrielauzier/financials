import { describe, expect, it } from 'vitest';
import { AppError } from '../../plugins/errors.js';
import { assertPaidWithinTotal, parsePaidAmount, parseRecurrencyDay, parseTotalAmount } from './validation.js';

function rejection(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected the call to throw');
}

describe('parseTotalAmount', () => {
  it('returns the canonical 2-decimal string', () => {
    expect(parseTotalAmount('600')).toBe('600.00');
    expect(parseTotalAmount('0.01')).toBe('0.01');
    expect(parseTotalAmount('999999999999.99')).toBe('999999999999.99');
  });

  it.each(['0', '0.00', '-1', '1.001', ' 1', '', 'x', 600, true, null, undefined, {}])(
    'rejects %j with invalid_amount on totalAmount',
    (value) => {
      expect(rejection(() => parseTotalAmount(value))).toMatchObject({
        code: 'invalid_amount',
        status: 422,
        field: 'totalAmount',
      });
    },
  );
});

describe('parsePaidAmount', () => {
  it('accepts zero in any spelling and canonicalizes', () => {
    for (const zero of ['0', '0.0', '0.00', '000']) expect(parsePaidAmount(zero)).toBe('0.00');
    expect(parsePaidAmount('200.5')).toBe('200.50');
  });

  it.each(['-0.01', '1.001', ' 1', '', 'x', 0, 5, true, null, undefined, {}])(
    'rejects %j with invalid_paid_amount on paidAmount',
    (value) => {
      expect(rejection(() => parsePaidAmount(value))).toMatchObject({
        code: 'invalid_paid_amount',
        status: 422,
        field: 'paidAmount',
      });
    },
  );
});

describe('assertPaidWithinTotal', () => {
  it('accepts paid below and equal to the total', () => {
    expect(() => assertPaidWithinTotal('0.00', '0.01')).not.toThrow();
    expect(() => assertPaidWithinTotal('600.00', '600.00')).not.toThrow();
  });

  it('rejects paid above the total by one cent, with no float involved', () => {
    expect(rejection(() => assertPaidWithinTotal('600.01', '600.00'))).toMatchObject({
      code: 'invalid_paid_amount',
      field: 'paidAmount',
    });
    expect(() => assertPaidWithinTotal('999999999999.99', '999999999999.98')).toThrow(AppError);
  });
});

describe('parseRecurrencyDay', () => {
  it.each([1, 15, 31])('accepts %j', (day) => {
    expect(parseRecurrencyDay(day)).toBe(day);
  });

  it.each([0, 32, -1, 5.5, '5', '', null, undefined, true, {}, NaN, Infinity])(
    'rejects %j with invalid_day on recurrencyDay',
    (value) => {
      expect(rejection(() => parseRecurrencyDay(value))).toMatchObject({
        code: 'invalid_day',
        status: 422,
        field: 'recurrencyDay',
      });
    },
  );
});
