import { describe, expect, it } from 'vitest';
import { AppError } from '../../plugins/errors.js';
import { parseAmount, parseReceiptUrl } from './validation.js';

function rejection(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected the call to throw');
}

describe('parseAmount', () => {
  it.each([10.5, 0, true, null, undefined, {}, ['1.00']])('rejects the non-string %j with invalid_amount', (value) => {
    expect(rejection(() => parseAmount(value))).toMatchObject({ code: 'invalid_amount', status: 422, field: 'amount' });
  });

  it('accepts valid amounts, including 0.01 and 12-digit integers, in canonical 2-decimal form', () => {
    expect(parseAmount('0.01')).toBe('0.01');
    expect(parseAmount('1234.56')).toBe('1234.56');
    expect(parseAmount('999999999999')).toBe('999999999999.00');
    expect(parseAmount('999999999999.99')).toBe('999999999999.99');
  });

  it('pads missing decimals and drops leading zeros', () => {
    expect(parseAmount('10')).toBe('10.00');
    expect(parseAmount('7.5')).toBe('7.50');
    expect(parseAmount('007.5')).toBe('7.50');
    expect(parseAmount('0.5')).toBe('0.50');
  });

  it.each(['0', '0.0', '0.00', '00.00'])('rejects zero (%s) with invalid_amount on field amount', (input) => {
    expect(rejection(() => parseAmount(input))).toMatchObject({ code: 'invalid_amount', status: 422, field: 'amount' });
  });

  it.each(['-1', '-0.01', '+1'])('rejects signed amounts (%s)', (input) => {
    expect(rejection(() => parseAmount(input)).code).toBe('invalid_amount');
  });

  it('rejects 3 decimals and 13 integer digits', () => {
    expect(rejection(() => parseAmount('1.001')).code).toBe('invalid_amount');
    expect(rejection(() => parseAmount('1.234')).code).toBe('invalid_amount');
    expect(rejection(() => parseAmount('1000000000000')).code).toBe('invalid_amount');
  });

  it.each(['', 'abc', '1,50', '1.', '.5', '1e3', ' 10', '10 ', '1.2.3', '١٢'])(
    'rejects non-numeric or malformed input (%j)',
    (input) => {
      expect(rejection(() => parseAmount(input)).code).toBe('invalid_amount');
    },
  );
});

describe('parseReceiptUrl', () => {
  it('accepts http and https URLs unchanged', () => {
    expect(parseReceiptUrl('http://example.com/r/1')).toBe('http://example.com/r/1');
    expect(parseReceiptUrl('https://example.com/r?id=1#x')).toBe('https://example.com/r?id=1#x');
  });

  it.each(['ftp://example.com/file', 'javascript:alert(1)', 'not a url', 'example.com/receipt', '', 'https://', 'file:///etc/passwd'])(
    'rejects %j with invalid_receipt_url on field receipt',
    (input) => {
      expect(rejection(() => parseReceiptUrl(input))).toMatchObject({
        code: 'invalid_receipt_url',
        status: 422,
        field: 'receipt',
      });
    },
  );
});
