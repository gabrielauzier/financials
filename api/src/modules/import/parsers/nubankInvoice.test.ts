import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../test/helpers/fixtures.js';
import { parseNubankInvoice } from './nubankInvoice.js';

const HEADER = 'date,title,amount';

function one(line: string) {
  const { rows } = parseNubankInvoice(`${HEADER}\n${line}\n`);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

describe('parseNubankInvoice (real sample)', () => {
  const { rows } = parseNubankInvoice(fixture('nubank_invoice.csv'));

  it('yields 19 rows: 18 Expense purchases and 1 ignored "Pagamento recebido"', () => {
    expect(rows).toHaveLength(19);
    const purchases = rows.filter((r) => r.status === 'new');
    expect(purchases).toHaveLength(18);
    expect(purchases.every((r) => r.type === 'Expense')).toBe(true);
    const ignored = rows.filter((r) => r.status === 'ignored');
    expect(ignored).toHaveLength(1);
    expect(ignored[0]).toMatchObject({ name: 'Pagamento recebido', index: 11, amount: '1335.61' });
  });

  it('maps every purchase to CreditCard, Uncategorized, with ISO date as local date', () => {
    for (const row of rows.filter((r) => r.status === 'new')) {
      expect(row.paymentMethod).toBe('CreditCard');
      expect(row.categoryKey).toBe('Uncategorized');
      expect(row.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(rows[0]).toMatchObject({ localDate: '2026-10-03', name: 'Ec *Hbomaxassin', amount: '38.16', index: 0 });
  });

  it('keeps the installment title integrally with amount 343.72', () => {
    const row = rows.find((r) => r.name === 'Prado Som Car - Parcela 3/6');
    expect(row).toMatchObject({ amount: '343.72', type: 'Expense', status: 'new' });
  });

  it('parses decimal commas ("54,50" and "1.335,61") into canonical strings', () => {
    expect(rows.find((r) => r.name === 'Petlove Saud*Petlove S')?.amount).toBe('54.50');
    expect(rows.find((r) => r.name === 'Pagamento recebido')?.amount).toBe('1335.61');
  });

  it('has a null identifier and null counterparty on every row', () => {
    for (const row of rows) {
      expect(row.identifier).toBeNull();
      expect(row.counterpartyDocument).toBeNull();
      expect(row.counterpartyBank).toBeNull();
    }
  });

  it('numbers rows from 0 without the header', () => {
    expect(rows.map((r) => r.index)).toEqual([...Array(19).keys()]);
  });
});

describe('parseNubankInvoice amounts', () => {
  it('treats the negative form with a space after the minus as ignored', () => {
    expect(one('2026-09-14,Pagamento recebido,"- 1.335,61"')).toMatchObject({
      status: 'ignored',
      amount: '1335.61',
    });
  });

  it('treats a negative form without a space as ignored too', () => {
    expect(one('2026-09-14,Estorno,"-10,00"')).toMatchObject({ status: 'ignored', amount: '10.00' });
  });

  it('pads one decimal and handles several thousand groups', () => {
    expect(one('2026-09-14,X,"5,5"').amount).toBe('5.50');
    expect(one('2026-09-14,X,"1.234.567,89"').amount).toBe('1234567.89');
  });

  it('marks an invalid or zero amount as invalid with a reason', () => {
    for (const amount of ['abc', '', '12.50', '1,234', '0,00', '1.33,61', '--5,00', '1,']) {
      const row = one(`2026-09-14,X,"${amount}"`);
      expect(row.status, amount).toBe('invalid');
      expect(row.reason, amount).toBeTruthy();
    }
  });
});

describe('parseNubankInvoice dates and resilience', () => {
  it('marks an invalid or non-ISO date as invalid with a reason', () => {
    for (const date of ['2026-02-31', '2026-13-01', '03/10/2026', '2026-1-1', '']) {
      const row = one(`${date},X,"10,00"`);
      expect(row.status, date).toBe('invalid');
      expect(row.reason, date).toBeTruthy();
    }
  });

  it('keeps the other rows and indexes when one row is invalid', () => {
    const { rows } = parseNubankInvoice(`${HEADER}\n2026-09-01,A,"1,00"\nbad,B,"2,00"\n2026-09-03,C,"3,00"\n`);
    expect(rows.map((r) => [r.index, r.status])).toEqual([
      [0, 'new'],
      [1, 'invalid'],
      [2, 'new'],
    ]);
  });

  it('marks a row with a missing column as invalid', () => {
    expect(one('2026-09-01,A')).toMatchObject({ status: 'invalid' });
  });

  it('parses CRLF and BOM like the plain file', () => {
    const text = fixture('nubank_invoice.csv');
    expect(parseNubankInvoice('﻿' + text.replace(/\r?\n/g, '\r\n'))).toEqual(parseNubankInvoice(text));
  });
});
