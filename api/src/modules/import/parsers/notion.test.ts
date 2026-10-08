import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../test/helpers/fixtures.js';
import { NOTION_HEADER, parseNotion } from './notion.js';

const HEADER = NOTION_HEADER.join(',');
const BOM = String.fromCharCode(0xfeff);

interface Fields {
  name?: string;
  type?: string;
  date?: string;
  amount?: string;
  category?: string;
  method?: string;
  notes?: string;
  receipt?: string;
  id?: string;
  identifier?: string;
}

/** One data row built from named fields; the defaults are a plain, valid Expense. */
function one(f: Fields = {}) {
  const cells = [
    f.name ?? 'Loja Teste',
    f.type ?? 'Expense',
    f.date ?? '05/03/2025',
    f.amount ?? 'R$10.00',
    f.category ?? 'Food',
    f.method ?? 'PIX',
    f.notes ?? '',
    f.receipt ?? '',
    'March 05, 2025 9:00 AM',
    f.id ?? '1',
    f.identifier ?? '',
  ];
  const line = cells.map((c) => (/[",\n]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c)).join(',');
  const { rows } = parseNotion(`${HEADER}\n${line}\n`);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

describe('parseNotion amounts', () => {
  it.each([
    ['R$25.00', '25.00'],
    ['R$9,999.99', '9999.99'],
    ['R$1,234,567.80', '1234567.80'],
    ['R$7.5', '7.50'],
    ['R$7', '7.00'],
    ['R$0.05', '0.05'],
  ])('reads %s as %s', (amount, expected) => {
    expect(one({ amount })).toMatchObject({ amount: expected, status: 'new' });
  });

  it('never goes through a float: 12 integer digits keep every digit', () => {
    expect(one({ amount: 'R$999,999,999,999.99' }).amount).toBe('999999999999.99');
  });

  it.each(['R$0.00', 'R$0', '-R$0.00', 'R$1.234', 'R$1,23', 'R$1,2345.00', '25.00', 'R$', 'R$abc', 'R$1.000,00', 'R$1,000,0.00', '--R$5.00', 'R$5.', 'R$1000,000.00', 'R$1,000,000,000,000.00', '5,00 R$'])(
    'marks %s invalid',
    (amount) => {
      expect(one({ amount })).toMatchObject({ status: 'invalid', reason: expect.stringContaining('amount') as string });
    },
  );

  it('marks an empty amount invalid, keeping the date and name for the listing', () => {
    expect(one({ amount: '', name: 'Sem Valor' })).toMatchObject({
      status: 'invalid', reason: 'Empty amount', name: 'Sem Valor', localDate: '2025-03-05',
    });
  });
});

describe('parseNotion Type', () => {
  it('keeps Expense and Income as written, with the absolute amount', () => {
    expect(one({ type: 'Expense', amount: 'R$10.00' })).toMatchObject({ type: 'Expense', amount: '10.00', status: 'new' });
    expect(one({ type: 'Income', amount: 'R$10.00' })).toMatchObject({ type: 'Income', amount: '10.00', status: 'new' });
  });

  it('a negative amount on an Expense becomes its absolute value', () => {
    expect(one({ type: 'Expense', amount: '-R$45.00' })).toMatchObject({ type: 'Expense', amount: '45.00', status: 'new' });
  });

  it('a negative amount on an Income stays an Income of the absolute value', () => {
    expect(one({ type: 'Income', amount: '-R$45.00' })).toMatchObject({ type: 'Income', amount: '45.00' });
  });

  it('Neutral is a neutral-hinted Expense', () => {
    const row = one({ type: 'Neutral', amount: 'R$30.00', category: 'Reversal' });
    expect(row).toMatchObject({ type: 'Expense', amount: '30.00', neutralHint: true, status: 'new' });
    expect(one({ type: 'Expense' }).neutralHint).toBeUndefined();
  });

  it('Canceled is ignored, with or without a valid amount', () => {
    expect(one({ type: 'Canceled' })).toMatchObject({ status: 'ignored', name: 'Loja Teste' });
    expect(one({ type: 'Canceled', amount: '' }).status).toBe('ignored');
    expect(one({ type: 'Canceled', amount: 'R$0.00', identifier: 'abc' })).toMatchObject({ status: 'ignored' });
  });

  it('an unknown Type is invalid', () => {
    expect(one({ type: 'Transfer' })).toMatchObject({ status: 'invalid', reason: 'Unknown type "Transfer"' });
  });

  describe('blank Type follows the sign', () => {
    it('negative is an Expense', () => {
      expect(one({ type: '', amount: '-R$18.00' })).toMatchObject({ type: 'Expense', amount: '18.00', status: 'new' });
    });

    it('negative stays an Expense even with no category and no method', () => {
      expect(one({ type: '', amount: '-R$18.00', category: '', method: '' })).toMatchObject({ type: 'Expense', status: 'new' });
    });

    it('positive with neither category nor method is an Income', () => {
      expect(one({ type: '', amount: 'R$300.00', category: '', method: '' })).toMatchObject({
        type: 'Income', amount: '300.00', status: 'new',
      });
    });

    it('positive with a category is an unrecognized Expense (Tipo ausente)', () => {
      expect(one({ type: '', amount: 'R$22.00', category: 'Food', method: '' })).toMatchObject({
        type: 'Expense', status: 'unrecognized', reason: 'Tipo ausente',
      });
    });

    it('positive with only a method is an unrecognized Expense (Tipo ausente)', () => {
      expect(one({ type: '', amount: 'R$22.00', category: '', method: 'PIX' })).toMatchObject({
        type: 'Expense', status: 'unrecognized', reason: 'Tipo ausente',
      });
    });
  });
});

describe('parseNotion payment method', () => {
  it.each([
    ['Debit Card', 'DebitCard'],
    ['Credit Card', 'CreditCard'],
    ['Bank Transfer', 'BankTransfer'],
    ['PIX', 'PIX'],
    ['Boleto', 'Boleto'],
    ['Cash', 'Cash'],
    ['NuPay', 'NuPay'],
  ])('maps %s to %s', (method, expected) => {
    expect(one({ method })).toMatchObject({ paymentMethod: expected, status: 'new' });
  });

  it('a blank method is Other without a warning', () => {
    expect(one({ method: '' })).toMatchObject({ paymentMethod: 'Other', status: 'new' });
    expect(one({ method: '' }).reason).toBeUndefined();
  });

  it('an unknown method is Other and unrecognized, naming the text', () => {
    expect(one({ method: 'Cheque' })).toMatchObject({
      paymentMethod: 'Other', status: 'unrecognized', reason: 'Forma de pagamento "Cheque" não reconhecida',
    });
  });

  it('joins the reasons of a row that has several', () => {
    expect(one({ type: '', amount: 'R$5.00', method: 'Cheque' })).toMatchObject({
      status: 'unrecognized', reason: 'Tipo ausente; Forma de pagamento "Cheque" não reconhecida',
    });
  });
});

describe('parseNotion other fields', () => {
  it('reads dd/mm/yyyy as a local date and rejects impossible or malformed dates', () => {
    expect(one({ date: '29/02/2024' }).localDate).toBe('2024-02-29');
    for (const date of ['31/02/2025', '2025-03-05', '5/3/2025', '']) {
      expect(one({ date }), date).toMatchObject({ status: 'invalid', reason: `Invalid date "${date}"` });
    }
  });

  it('collapses the spaces of the name and rejects a blank name', () => {
    expect(one({ name: '  Loja   do  Teste ' }).name).toBe('Loja do Teste');
    expect(one({ name: '   ' })).toMatchObject({ status: 'invalid', reason: 'Empty name' });
  });

  it('keeps the category text raw (trimmed) for the resolution, with the default key', () => {
    expect(one({ category: ' Leo 😺 ' })).toMatchObject({ categoryLabel: 'Leo 😺', categoryKey: 'Uncategorized' });
    expect(one({ category: '' }).categoryLabel).toBe('');
  });

  it('has no description, no counterparty and trims notes (blank is null)', () => {
    expect(one({ notes: '  uma nota  ' })).toMatchObject({
      description: '', counterpartyDocument: null, counterpartyBank: null, notes: 'uma nota',
    });
    expect(one({ notes: '   ' }).notes).toBeNull();
  });

  it('takes the Identifier column as the identifier and never the ID column', () => {
    expect(one({ identifier: ' abc-123 ', id: '555' }).identifier).toBe('abc-123');
    expect(one({ identifier: '', id: '555' }).identifier).toBeNull();
  });

  it('ignores Created time and ID entirely (a garbage value changes nothing)', () => {
    const line = (created: string, id: string) =>
      `${HEADER}\nLoja,Expense,05/03/2025,R$10.00,Food,PIX,,,${created},${id},\n`;
    expect(parseNotion(line('not a date', 'xyz')).rows).toEqual(parseNotion(line('"March 05, 2025 9:00 AM"', '1')).rows);
  });

  it('keeps a valid http(s) receipt and treats a blank receipt as none', () => {
    expect(one({ receipt: 'https://example.com/r/1' }).receipt).toBe('https://example.com/r/1');
    expect(one({ receipt: 'http://example.com/r' }).receipt).toBe('http://example.com/r');
    expect(one({ receipt: '' }).receipt).toBeNull();
  });

  it('marks a row with an invalid receipt URL invalid', () => {
    for (const receipt of ['recibo-sem-url', 'ftp://example.com/r', 'javascript:alert(1)']) {
      expect(one({ receipt }), receipt).toMatchObject({ status: 'invalid', reason: `Invalid receipt URL "${receipt}"` });
    }
  });

  it('marks a row with the wrong number of columns invalid without aborting the file', () => {
    const { rows } = parseNotion(`${HEADER}\nLoja,Expense,05/03/2025\nOutra,Expense,05/03/2025,R$1.00,Food,PIX,,,x,1,\n`);
    expect(rows[0]).toMatchObject({ status: 'invalid', reason: 'Expected 11 columns, found 3' });
    expect(rows[1]).toMatchObject({ status: 'new', index: 1 });
  });

  it('reads a file with BOM and CRLF', () => {
    const text = `${BOM}${HEADER}\r\nLoja,Expense,05/03/2025,R$10.00,Food,PIX,,,x,1,\r\n`;
    expect(parseNotion(text).rows).toHaveLength(1);
  });
});

describe('parseNotion fixture', () => {
  const rows = parseNotion(fixture('notion_sanitized.csv')).rows;
  const by = (i: number) => rows[i]!;

  it('indexes rows from 0 and counts the statuses', () => {
    expect(rows.map((r) => r.index)).toEqual([...Array(27).keys()]);
    const count = (status: string) => rows.filter((r) => r.status === status).length;
    expect({ new: count('new'), unrecognized: count('unrecognized'), ignored: count('ignored'), invalid: count('invalid') }).toEqual({
      new: 21, unrecognized: 1 + 1, ignored: 2, invalid: 2,
    });
  });

  it('reads the amount shapes, the signed expense and the collapsed name', () => {
    expect(by(0)).toMatchObject({ amount: '25.37', type: 'Expense', paymentMethod: 'DebitCard', name: 'Empório Zeta' });
    expect(by(1)).toMatchObject({ amount: '9999.99', paymentMethod: 'CreditCard' });
    expect(by(2)).toMatchObject({ amount: '1234.50', type: 'Income', paymentMethod: 'BankTransfer' });
    expect(by(3)).toMatchObject({ amount: '45.61', type: 'Expense' });
    expect(by(4).name).toBe('Forneria Zeta');
  });

  it('flags the neutral, canceled, blank-type and empty-amount rows', () => {
    expect(by(5)).toMatchObject({ neutralHint: true, type: 'Expense' });
    expect(by(7).status).toBe('ignored');
    expect(by(8).status).toBe('ignored');
    expect(by(9)).toMatchObject({ type: 'Expense', status: 'new' });
    expect(by(10)).toMatchObject({ type: 'Income', status: 'new' });
    expect(by(11)).toMatchObject({ type: 'Expense', status: 'unrecognized', reason: 'Tipo ausente' });
    expect(by(12)).toMatchObject({ status: 'invalid', reason: 'Empty amount' });
  });

  it('carries notes, receipt and the Identifier (not the ID)', () => {
    expect(by(0)).toMatchObject({ notes: 'Nota fictícia um', identifier: '00000000-0000-4000-8000-000000000001' });
    expect(by(21)).toMatchObject({ receipt: 'https://example.com/recibos/1', status: 'new' });
    expect(by(22).status).toBe('invalid');
    expect(rows.filter((r) => r.identifier !== null)).toHaveLength(4);
    expect(by(4).identifier).toBeNull();
    expect(by(9).identifier).toBeNull();
  });
});
