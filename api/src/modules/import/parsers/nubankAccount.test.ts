import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../test/helpers/fixtures.js';
import { parseNubankAccount } from './nubankAccount.js';

const HEADER = 'Data,Valor,Identificador,Descrição';
const ID = '6a442c8d-0f0c-471a-8aba-ca4523ca8ebb';

function one(line: string) {
  const { rows } = parseNubankAccount(`${HEADER}\n${line}\n`);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

describe('parseNubankAccount core fields (real sample)', () => {
  const { rows } = parseNubankAccount(fixture('nubank_account.csv'));

  it('yields the 14 rows of the sample, indexed from 0 without the header', () => {
    expect(rows).toHaveLength(14);
    expect(rows.map((r) => r.index)).toEqual([...Array(14).keys()]);
  });

  it('maps date, type, absolute amount and identifier of the first rows', () => {
    expect(rows[0]).toMatchObject({
      localDate: '2026-07-02',
      type: 'Expense',
      amount: '82.32',
      identifier: ID,
    });
    expect(rows[1]).toMatchObject({ localDate: '2026-07-02', type: 'Expense', amount: '6300.74' });
    expect(rows[2]).toMatchObject({
      localDate: '2026-07-02',
      type: 'Income',
      amount: '8608.00',
      identifier: '6a46ebe4-6e90-4411-97e9-2c5185394f9a',
    });
    expect(rows[7]).toMatchObject({ localDate: '2026-07-13', type: 'Expense', amount: '706.34' });
    expect(rows[13]).toMatchObject({ localDate: '2026-07-28', type: 'Expense', amount: '1000.00' });
  });

  it('classifies negative as Expense and positive as Income across the file', () => {
    expect(rows.filter((r) => r.type === 'Income').map((r) => r.index)).toEqual([2, 6]);
    expect(rows.filter((r) => r.type === 'Expense')).toHaveLength(12);
  });

  it('gives every row a distinct identifier and no invalid status', () => {
    expect(new Set(rows.map((r) => r.identifier)).size).toBe(14);
    expect(rows.every((r) => r.status !== 'invalid')).toBe(true);
  });
});

describe('parseNubankAccount amounts and dates', () => {
  it('uses the absolute value as a canonical 2-decimal string', () => {
    expect(one(`02/07/2026,-82.32,${ID},X`)).toMatchObject({ type: 'Expense', amount: '82.32' });
    expect(one(`02/07/2026,-5,${ID},X`).amount).toBe('5.00');
    expect(one(`02/07/2026,7.5,${ID},X`)).toMatchObject({ type: 'Income', amount: '7.50' });
    expect(one(`02/07/2026,-0007.10,${ID},X`).amount).toBe('7.10');
  });

  it('does not lose precision on amounts a float cannot hold', () => {
    expect(one(`02/07/2026,123456789012.99,${ID},X`).amount).toBe('123456789012.99');
    expect(one(`02/07/2026,0.10,${ID},X`).amount).toBe('0.10');
  });

  it('marks a zero value as invalid with a reason', () => {
    const row = one(`02/07/2026,0.00,${ID},X`);
    expect(row.status).toBe('invalid');
    expect(row.reason).toBeTruthy();
    expect(one(`02/07/2026,-0,${ID},X`).status).toBe('invalid');
  });

  it('marks an impossible or malformed date as invalid with a reason', () => {
    for (const date of ['31/02/2026', '32/01/2026', '00/01/2026', '02/13/2026', '2026-07-02', '2/7/2026', '']) {
      const row = one(`${date},-1.00,${ID},X`);
      expect(row.status, date).toBe('invalid');
      expect(row.reason, date).toBeTruthy();
    }
    expect(one(`29/02/2028,-1.00,${ID},X`).localDate).toBe('2028-02-29');
    expect(one(`29/02/2026,-1.00,${ID},X`).status).toBe('invalid');
  });

  it('marks a non-numeric value as invalid with a reason', () => {
    for (const value of ['abc', '', '1,50', '--5', '1.2.3', 'NaN', '1e3']) {
      const row = one(`02/07/2026,${value},${ID},X`);
      expect(row.status, value).toBe('invalid');
      expect(row.reason, value).toBeTruthy();
    }
  });

  it('marks a value with more than 2 decimals as invalid instead of rounding it', () => {
    expect(one(`02/07/2026,-1.005,${ID},X`).status).toBe('invalid');
  });

  it('marks a row with the wrong number of columns as invalid', () => {
    const { rows } = parseNubankAccount(`${HEADER}\n02/07/2026,-1.00\n`);
    expect(rows[0]).toMatchObject({ index: 0, status: 'invalid' });
  });
});

describe('parseNubankAccount resilience', () => {
  it('keeps the other rows and their indexes when one row is invalid', () => {
    const text = [HEADER, `02/07/2026,-1.00,a,X`, `31/02/2026,-2.00,b,X`, `04/07/2026,3.00,c,X`, ''].join('\n');
    const { rows } = parseNubankAccount(text);
    expect(rows.map((r) => [r.index, r.status])).toEqual([
      [0, 'new'],
      [1, 'invalid'],
      [2, 'new'],
    ]);
  });

  it('parses CRLF and BOM like the plain file', () => {
    const text = fixture('nubank_account.csv');
    const crlf = '﻿' + text.replace(/\r?\n/g, '\r\n');
    expect(parseNubankAccount(crlf)).toEqual(parseNubankAccount(text));
  });
});
