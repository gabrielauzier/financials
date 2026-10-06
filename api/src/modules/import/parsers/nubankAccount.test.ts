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
    const text = [HEADER, `02/07/2026,-1.00,a,Débito em conta`, `31/02/2026,-2.00,b,Débito em conta`, `04/07/2026,3.00,c,Débito em conta`, ''].join('\n');
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

describe('parseNubankAccount Pix extraction (real sample)', () => {
  const { rows } = parseNubankAccount(fixture('nubank_account.csv'));
  const pix = rows.filter((r) => r.paymentMethod === 'PIX');

  it('extracts name, document, bank and PIX method for the MERCADO AUTO row (double space collapsed)', () => {
    expect(rows[2]).toMatchObject({
      name: 'MERCADO AUTO SOLUCOES PUBLICIDADE E TECNOLOGIA LTDA',
      counterpartyDocument: '41.460.383/0001-68',
      counterpartyBank: 'BCO SANTANDER (BRASIL) S.A. (0033)',
      paymentMethod: 'PIX',
      type: 'Income',
      amount: '8608.00',
      categoryKey: 'Uncategorized',
      status: 'new',
    });
  });

  it('captures the masked document and the bank with " - " intact for the own-holder rows (the sample has 6, not 5)', () => {
    const own = pix.filter((r) => r.name === 'Gabriel Vasconcelos Auzier');
    expect(own.map((r) => r.index)).toEqual([3, 4, 5, 8, 12, 13]);
    for (const row of own) {
      expect(row.counterpartyDocument).toBe('•••.224.672-••');
      expect(row.counterpartyBank).toBe('NU PAGAMENTOS - IP (0260)');
    }
  });

  it('parses every Pix row of the fixture with a name and a document', () => {
    expect(pix).toHaveLength(11);
    for (const row of pix) {
      expect(row.name).not.toBe('');
      expect(row.counterpartyDocument).toMatch(/^[\d./•*-]+$/);
      expect(row.counterpartyBank).toBeTruthy();
      expect(row.name).not.toMatch(/ {2}|^Transferência/);
    }
  });

  it('reads a receita federal row and a received row from another bank', () => {
    expect(rows[9]).toMatchObject({
      name: 'RECEITA FEDERAL',
      counterpartyDocument: '00.394.460/0058-87',
      counterpartyBank: 'BCO DO BRASIL S.A. (0001)',
      type: 'Expense',
    });
    expect(rows[6]).toMatchObject({
      name: 'LOLDESIGN SOLUCOES DIGITAIS LTDA',
      counterpartyDocument: '13.182.800/0001-12',
      counterpartyBank: 'ITAÚ UNIBANCO S.A. (0341)',
      type: 'Income',
    });
  });

  it('does not treat a name containing " - " as Pix (documented limitation)', () => {
    const row = one(`02/07/2026,-1.00,x,Transferência enviada pelo Pix - A - B - 12.345.678/0001-90 - BANCO X (001) Agência: 1 Conta: 2`);
    expect(row.paymentMethod).not.toBe('PIX');
  });
});

describe('parseNubankAccount non-Pix descriptions (real sample)', () => {
  const { rows } = parseNubankAccount(fixture('nubank_account.csv'));

  it('maps "Débito em conta" to DebitCard / Uncategorized with name = description', () => {
    expect(rows[0]).toMatchObject({
      name: 'Débito em conta',
      paymentMethod: 'DebitCard',
      categoryKey: 'Uncategorized',
      status: 'new',
    });
  });

  it('maps "Pagamento de fatura" to BankTransfer / Uncategorized, Expense by sign', () => {
    expect(rows[7]).toMatchObject({
      name: 'Pagamento de fatura',
      paymentMethod: 'BankTransfer',
      categoryKey: 'Uncategorized',
      type: 'Expense',
      status: 'new',
    });
  });

  it('maps the planned savings redemption to BankTransfer / Investments', () => {
    expect(rows[1]).toMatchObject({
      name: 'Dinheiro guardado com resgate planejado',
      paymentMethod: 'BankTransfer',
      categoryKey: 'Investments',
      status: 'new',
    });
  });

  it('leaves the counterparty fields null on every non-Pix row', () => {
    const others = rows.filter((r) => r.paymentMethod !== 'PIX');
    expect(others.map((r) => r.index)).toEqual([0, 1, 7]);
    for (const row of others) {
      expect(row.counterpartyDocument).toBeNull();
      expect(row.counterpartyBank).toBeNull();
    }
  });

  it('flags an unknown description as unrecognized (Other) but still importable data', () => {
    const row = one(`02/07/2026,-10.00,x,Compra com cartão fora da tabela - LOJA`);
    expect(row).toMatchObject({
      status: 'unrecognized',
      name: 'Compra com cartão fora da tabela - LOJA',
      paymentMethod: 'Other',
      categoryKey: 'Uncategorized',
      type: 'Expense',
      amount: '10.00',
      counterpartyDocument: null,
      counterpartyBank: null,
    });
    expect(row.reason).toBeUndefined();
  });

  it('maps "Compra no débito - LOJA" to DebitCard with the name LOJA (no longer unrecognized)', () => {
    expect(one(`02/07/2026,-10.00,x,Compra no débito - LOJA`)).toMatchObject({
      status: 'new',
      name: 'LOJA',
      paymentMethod: 'DebitCard',
      categoryKey: 'Uncategorized',
    });
  });

  it('keeps the sign-based type for known descriptions with a positive value', () => {
    expect(one('02/07/2026,50.00,x,Débito em conta')).toMatchObject({ type: 'Income', status: 'new' });
  });

  it('keeps no known description unrecognized: the whole sample has none', () => {
    expect(rows.filter((r) => r.status === 'unrecognized')).toEqual([]);
  });
});

describe('blank descriptions (a row that could not be saved)', () => {
  it.each(['', '   '])('marks an empty description %j as invalid with the reason', (description) => {
    expect(one(`02/07/2026,-10.00,id-1,${description}`)).toMatchObject({
      status: 'invalid',
      reason: 'Empty description',
      identifier: 'id-1',
      localDate: '2026-07-02',
    });
  });
});


describe('parseNubankAccount on the sanitized September statement (IMPFIX-04, 05, 07)', () => {
  const text = fixture('nubank_statement_sanitized.csv');
  const { rows } = parseNubankAccount(text);
  const count = (key: (r: (typeof rows)[number]) => string) =>
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {});

  it('yields 96 new rows and no unrecognized or invalid row', () => {
    expect(rows).toHaveLength(96);
    expect(count((r) => r.status)).toEqual({ new: 96 });
  });

  it('counts the payment methods of every format: 61 / 6 / 19 / 4 / 6 / 0', () => {
    expect(count((r) => r.paymentMethod)).toEqual({ DebitCard: 61, NuPay: 6, PIX: 19, BankTransfer: 4, Boleto: 6 });
  });

  it('assigns Reversal to the 8 estornos and Uncategorized to the other 88', () => {
    expect(count((r) => r.categoryKey)).toEqual({ Reversal: 8, Uncategorized: 88 });
    const estornos = rows.filter((r) => r.categoryKey === 'Reversal');
    expect(estornos.every((r) => r.paymentMethod === 'DebitCard' && r.type === 'Income')).toBe(true);
    expect(new Set(estornos.map((r) => r.name))).toEqual(new Set(['RIDEX *VIAGEM CENTRAL']));
  });

  it('extracts the names of the 4 rows that carry a holder name', () => {
    const holders = rows.filter((r) => /^maria souza lima( ltda)?$/i.test(r.name));
    expect(holders.map((r) => [r.paymentMethod, r.name, r.type])).toEqual([
      ['PIX', 'Maria Souza Lima', 'Expense'],
      ['BankTransfer', 'MARIA SOUZA LIMA LTDA', 'Income'],
      ['BankTransfer', 'MARIA SOUZA LIMA LTDA', 'Income'],
      ['BankTransfer', 'MARIA SOUZA LIMA LTDA', 'Income'],
    ]);
    expect(holders[0]).toMatchObject({ counterpartyDocument: '•••.381.754-••', counterpartyBank: 'NU PAGAMENTOS - IP (0260)' });
  });

  it('derives the type from the sign in every format: 13 Income and 83 Expense', () => {
    expect(count((r) => r.type)).toEqual({ Income: 13, Expense: 83 });
  });

  it('gives every row the original text with collapsed spaces as description', () => {
    const lines = text.trim().split('\n').slice(1);
    expect(rows.map((r) => r.description)).toEqual(
      lines.map((line) => line.split(',').slice(3).join(',').replace(/\s+/g, ' ').trim()),
    );
    const doubleSpace = rows.find((r) => r.name === 'Vitor Hugo Siqueira');
    expect(doubleSpace?.description.startsWith('Transferência recebida pelo Pix - Vitor Hugo Siqueira - ')).toBe(true);
  });
});

describe('parseNubankAccount description field (IMPFIX-06, IMPFIX-07)', () => {
  it('cuts a 600-character description to 500 code points and leaves the name untouched', () => {
    const store = 'L'.repeat(600);
    const row = one(`02/07/2026,-10.00,x,Compra no débito - ${store}`);
    expect(Array.from(row.description)).toHaveLength(500);
    expect(row.description).toBe(`Compra no débito - ${store}`.slice(0, 500));
    expect(row.name).toBe(store);
  });

  it('keeps a description of 500 code points whole', () => {
    const text = `Compra no débito - ${'M'.repeat(481)}`;
    expect(Array.from(text)).toHaveLength(500);
    expect(one(`02/07/2026,-10.00,x,${text}`).description).toBe(text);
  });

  it('defines description (never undefined) for an invalid row', () => {
    expect(one('31/02/2026,-1.00,x,Compra no débito - Loja')).toMatchObject({ status: 'invalid', description: 'Compra no débito - Loja' });
    expect(one('02/07/2026,abc,x,Compra   no débito - Loja')).toMatchObject({ status: 'invalid', description: 'Compra no débito - Loja' });
    const empty = one('02/07/2026,-1.00,x,   ');
    expect(empty).toMatchObject({ status: 'invalid', reason: 'Empty description' });
    expect(empty.description).toBe('');
    const wrongColumns = parseNubankAccount(`${HEADER}\n02/07/2026,-1.00\n`).rows[0]!;
    expect(wrongColumns.description).toBe('');
  });

  it('keeps an unknown description whole as the name (not collapsed) and collapsed as the description', () => {
    expect(one('02/07/2026,-1.00,x,Coisa   estranha')).toMatchObject({
      status: 'unrecognized',
      paymentMethod: 'Other',
      name: 'Coisa   estranha',
      description: 'Coisa estranha',
    });
  });

  it('marks as unrecognized an Estorno of another kind and a transfer without NOME - DOC - BANCO Agência:', () => {
    expect(one('02/07/2026,5.00,x,Estorno - Pix - Fulano')).toMatchObject({ status: 'unrecognized', paymentMethod: 'Other' });
    expect(one('02/07/2026,-5.00,x,Transferência Enviada - Fulano')).toMatchObject({ status: 'unrecognized', paymentMethod: 'Other', name: 'Transferência Enviada - Fulano' });
  });

  it('maps a lowercase, unaccented Nubank prefix like the canonical one', () => {
    expect(one('02/07/2026,-5.00,x,COMPRA NO DEBITO VIA NUPAY - iFood')).toMatchObject({ status: 'new', paymentMethod: 'NuPay', name: 'iFood' });
  });
});
