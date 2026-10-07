import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../test/helpers/fixtures.js';
import { parseSofisaAccount } from './sofisaAccount.js';

const HEADER = 'Data;Descrição;Valor';
const BOM = String.fromCharCode(0xfeff);

function one(description: string, value: string, date = '04/11/2025') {
  const { rows } = parseSofisaAccount(`${HEADER}\n${date};${description};${value}\n`);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

const money = (value: string) => one('Juros Limite Especial', value);

describe('parseSofisaAccount fixtures (CSV and TSV)', () => {
  const csv = parseSofisaAccount(fixture('sofisa_statement_sanitized.csv')).rows;
  const tsv = parseSofisaAccount(fixture('sofisa_statement_sanitized.tsv')).rows;

  it('reads the 4-column TSV (empty third column) exactly like the 3-column CSV', () => {
    expect(tsv).toHaveLength(18);
    expect(tsv).toEqual(csv);
  });

  it('indexes rows from 0 without the header and invalidates none', () => {
    expect(csv.map((r) => r.index)).toEqual([...Array(18).keys()]);
    expect(csv.filter((r) => r.status === 'invalid')).toEqual([]);
  });

  it('counts statuses: 5 daily balances ignored, 13 importable, none unrecognized', () => {
    const count = (status: string) => csv.filter((r) => r.status === status).length;
    expect({ new: count('new'), ignored: count('ignored'), unrecognized: count('unrecognized') }).toEqual({
      new: 13,
      ignored: 5,
      unrecognized: 0,
    });
    expect(csv.filter((r) => r.status === 'ignored').map((r) => r.description)).toEqual([
      'Saldo em 03/11/2025',
      'Saldo em 04/11/2025',
      'Saldo em 05/11/2025',
      'Saldo em 06/11/2025',
      'Saldo em 07/11/2025',
    ]);
  });

  it('maps each description format to its method, category and name', () => {
    const by = (i: number) => csv[i]!;
    expect(by(0)).toMatchObject({
      localDate: '2025-11-03', type: 'Expense', amount: '0.07', name: 'IOF Limite Especial',
      paymentMethod: 'Other', categoryKey: 'Uncategorized', status: 'new', identifier: null,
    });
    expect(by(1)).toMatchObject({
      type: 'Expense', amount: '1.52', name: 'Juros Limite Especial', paymentMethod: 'Other', categoryKey: 'Uncategorized',
    });
    expect(by(3)).toMatchObject({
      type: 'Income', amount: '1215.30', name: 'Helena Prado Exemplo', paymentMethod: 'PIX', categoryKey: 'Uncategorized',
      description: 'Recebimento de transferência via PIX - De Helena Prado Exemplo',
      counterpartyDocument: null, counterpartyBank: null,
    });
    expect(by(4)).toMatchObject({ type: 'Income', amount: '12345.67', name: 'CASA EXEMPLO COMERCIO', paymentMethod: 'PIX' });
    expect(by(5)).toMatchObject({
      type: 'Expense', amount: '2088.40', name: 'PAGTO FATURA CARTAO DE CRED', paymentMethod: 'BankTransfer', categoryKey: 'Uncategorized',
    });
    expect(by(7)).toMatchObject({
      type: 'Expense', amount: '15000.00', name: 'Aplicação - Meus Investimentos - CDB DIRETO DI',
      paymentMethod: 'BankTransfer', categoryKey: 'Investments',
    });
    expect(by(11)).toMatchObject({
      type: 'Income', amount: '8.25', name: 'Cashback - Cartao Sofisa Visa', paymentMethod: 'Other', categoryKey: 'Uncategorized',
    });
    expect(by(12)).toMatchObject({
      type: 'Expense', amount: '8.25', name: 'Aplicação - cashback visa - CDB DIRETO DI', categoryKey: 'Investments',
    });
  });

  it('keeps the original text of every row as the description', () => {
    expect(csv[2]).toMatchObject({ description: 'Saldo em 03/11/2025' });
    expect(csv.every((r) => r.description !== '')).toBe(true);
  });

  it('keeps two identical rows of the same day as two rows (content duplicates are found at classify)', () => {
    expect(csv[8]).toMatchObject({ localDate: '2025-11-05', amount: '0.06', name: 'IOF Limite Especial' });
    expect(csv[9]).toMatchObject({ localDate: '2025-11-05', amount: '0.06', name: 'IOF Limite Especial' });
  });
});

describe('parseSofisaAccount money', () => {
  it('reads the sign before R$ as an Expense with the absolute amount', () => {
    expect(money('-R$ 0,23')).toMatchObject({ type: 'Expense', amount: '0.23', status: 'new' });
  });

  it('reads a value without a sign as an Income', () => {
    expect(one('Cashback - Cartao Sofisa Visa', 'R$ 3,50')).toMatchObject({ type: 'Income', amount: '3.50' });
  });

  it('reads the sign after R$ too', () => {
    expect(money('R$ -4,10')).toMatchObject({ type: 'Expense', amount: '4.10' });
    expect(money('-  R$   4,10')).toMatchObject({ type: 'Expense', amount: '4.10' });
  });

  it('removes dot thousand separators', () => {
    expect(money('-R$ 20.000,00').amount).toBe('20000.00');
    expect(money('-R$ 1.350,05').amount).toBe('1350.05');
    expect(money('-R$ 1.234.567,89').amount).toBe('1234567.89');
    expect(money('-R$ 1350,05').amount).toBe('1350.05');
  });

  it('accepts a non-breaking space and one-decimal values, and pads to 2 decimals', () => {
    expect(money('-R$ 7,30')).toMatchObject({ amount: '7.30' });
    expect(money('R$\u00a0-7,3')).toMatchObject({ type: 'Expense', amount: '7.30' });
    expect(money('\u00a0R$\u00a07,30\u00a0')).toMatchObject({ type: 'Income', amount: '7.30' });
  });

  it('accepts a value without the R$ symbol', () => {
    expect(money('-7,30')).toMatchObject({ type: 'Expense', amount: '7.30' });
  });

  it('does not lose precision on amounts a float cannot hold', () => {
    expect(money('R$ 123.456.789.012,99').amount).toBe('123456789012.99');
    expect(money('R$ 0,10').amount).toBe('0.10');
  });

  it('marks a zero value as invalid with a reason', () => {
    for (const value of ['R$ 0,00', '-R$ 0,00', '0,0']) {
      const row = money(value);
      expect(row.status, value).toBe('invalid');
      expect(row.reason, value).toBeTruthy();
    }
  });

  it('marks a malformed value as invalid with a reason', () => {
    for (const value of ['', 'abc', 'R$', 'R$ 1,234', 'R$ 1.5,00', 'R$ 1.23,00', 'R$ 12', 'R$ 1,2,3', '--R$ 1,00', '-R$ -1,00', 'R$ 1.000.00', 'US$ 1,00', 'R$ 1,00 x']) {
      const row = money(value);
      expect(row.status, value).toBe('invalid');
      expect(row.reason, value).toMatch(/amount/i);
    }
  });

  it('marks more than 12 integer digits as invalid (does not fit numeric(14,2))', () => {
    expect(money('R$ 1.234.567.890.123,00').status).toBe('invalid');
    expect(money('R$ 999.999.999.999,99').status).toBe('new');
  });
});

describe('parseSofisaAccount dates and shape', () => {
  it('marks an impossible or malformed date as invalid with a reason', () => {
    for (const date of ['31/02/2025', '00/11/2025', '04/13/2025', '2025-11-04', '4/11/2025', '']) {
      const row = one('Juros Limite Especial', '-R$ 1,00', date);
      expect(row.status, date).toBe('invalid');
      expect(row.reason, date).toMatch(/date/i);
    }
    expect(one('Juros Limite Especial', '-R$ 1,00', '29/02/2028').localDate).toBe('2028-02-29');
  });

  it('marks an empty description as invalid', () => {
    expect(one('  ', '-R$ 1,00')).toMatchObject({ status: 'invalid', reason: 'Empty description' });
  });

  it('marks a row with the wrong column count as invalid, without aborting the file', () => {
    const { rows } = parseSofisaAccount(`${HEADER}\n04/11/2025;Juros Limite Especial\n04/11/2025;Juros Limite Especial;-R$ 1,00\n04/11/2025;a;b;c;d\n`);
    expect(rows.map((r) => r.status)).toEqual(['invalid', 'new', 'invalid']);
    expect(rows[0]!.reason).toMatch(/columns/);
  });

  it('drops the third column only when it is empty (4-column TSV), otherwise the row is invalid', () => {
    const tsv = (third: string) =>
      parseSofisaAccount(`Data\tDescrição\t\tValor\n04/11/2025\tJuros Limite Especial\t${third}\t-R$ 1,00\n`).rows[0]!;
    expect(tsv('')).toMatchObject({ status: 'new', amount: '1.00' });
    expect(tsv('x')).toMatchObject({ status: 'invalid' });
  });

  it('accepts both header variants and parses a file with a BOM and CRLF', () => {
    const text = `${BOM}${HEADER}\r\n04/11/2025;Juros Limite Especial;-R$ 1,00\r\n`;
    expect(parseSofisaAccount(text).rows[0]).toMatchObject({ status: 'new', amount: '1.00' });
  });
});

describe('parseSofisaAccount daily balance and unseen formats', () => {
  it('ignores "Saldo em dd/mm/aaaa" whatever its value, even zero or malformed', () => {
    for (const value of ['R$ 9,10', '-R$ 9,10', 'R$ 0,00', 'lixo']) {
      expect(one('Saldo em 04/11/2025', value), value).toMatchObject({ status: 'ignored', identifier: null });
    }
    expect(one('Saldo em 04/11/2025', 'R$ 9,10').reason).toBeTruthy();
  });

  it('ignores the balance line regardless of case, accents and spacing', () => {
    expect(one('  SALDO  EM 04/11/2025 ', 'R$ 9,10').status).toBe('ignored');
  });

  it('does not ignore text that only starts like a balance line', () => {
    expect(one('Saldo em 04/11/2025 extra', '-R$ 9,10').status).toBe('unrecognized');
    expect(one('Saldo em conta', '-R$ 9,10').status).toBe('unrecognized');
  });

  it('keeps a balance row invalid when its date is invalid', () => {
    expect(one('Saldo em 04/11/2025', 'R$ 1,00', '31/02/2025').status).toBe('invalid');
  });

  it('leaves an unseen format as Other / unrecognized, still importable, with the text as name', () => {
    expect(one('Envio de transferência via PIX - Para Fulano', '-R$ 5,00')).toMatchObject({
      status: 'unrecognized',
      paymentMethod: 'Other',
      categoryKey: 'Uncategorized',
      name: 'Envio de transferência via PIX - Para Fulano',
      type: 'Expense',
      amount: '5.00',
    });
    expect(one('Resgate - CDB DIRETO DI', 'R$ 5,00')).toMatchObject({ status: 'unrecognized', type: 'Income' });
  });
});
