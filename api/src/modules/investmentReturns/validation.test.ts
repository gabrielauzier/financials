import { describe, expect, it } from 'vitest';
import { parseDate, parseSignedAmount } from './validation.js';

describe('parseSignedAmount', () => {
  it.each([
    ['50', '50.00'],
    ['-20', '-20.00'],
    ['-7.5', '-7.50'],
    ['0.01', '0.01'],
    ['-0.01', '-0.01'],
    ['007.10', '7.10'],
    ['999999999999.99', '999999999999.99'],
  ])('accepts %s as %s', (input, expected) => {
    expect(parseSignedAmount(input)).toBe(expected);
  });

  it.each(['0', '0.00', '-0', '-0.00', '1.234', '1000000000000', '+5', ' 5', '', '-', '1e3', '--1'])(
    'rejects %j',
    (input) => {
      expect(() => parseSignedAmount(input)).toThrow(expect.objectContaining({ code: 'invalid_amount', field: 'amount' }));
    },
  );

  it.each([5, -5, 0, null, undefined, true, {}])('rejects the non-string %j', (input) => {
    expect(() => parseSignedAmount(input)).toThrow(expect.objectContaining({ code: 'invalid_amount' }));
  });
});

describe('parseDate', () => {
  it('accepts real calendar dates, including a leap day', () => {
    expect(parseDate('2026-10-05')).toBe('2026-10-05');
    expect(parseDate('2028-02-29')).toBe('2028-02-29');
  });

  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '5/10/2026', '2026-10-05T00:00:00Z', '', 20261005, null])(
    'rejects %j',
    (input) => {
      expect(() => parseDate(input)).toThrow(expect.objectContaining({ code: 'invalid_date', field: 'occurredOn' }));
    },
  );
});
