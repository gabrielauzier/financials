import { describe, expect, it } from 'vitest';
import { describeStatement, originalText } from './descriptions.js';

const PIX_TAIL = '11.222.333/0001-81 - BCO ALFA (0123) Agência: 4321 Conta: 7654321-0';
const NU_TAIL = '11.444.777/0001-62 - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 3141592-6';
const NONE = { counterpartyDocument: null, counterpartyBank: null, status: 'new' } as const;

describe('describeStatement: one case per format of the table (IMPFIX-04, IMPFIX-05)', () => {
  const cases: [string, string, Record<string, unknown>][] = [
    ['compra no débito', 'Compra no débito - Padaria Estrela Azul', { paymentMethod: 'DebitCard', categoryKey: 'Uncategorized', name: 'Padaria Estrela Azul', ...NONE }],
    ['compra via NuPay', 'Compra no débito via NuPay - Entrega Rapida Foods', { paymentMethod: 'NuPay', categoryKey: 'Uncategorized', name: 'Entrega Rapida Foods', ...NONE }],
    ['compra no crédito', 'Compra no crédito - Livraria Papel e Tinta', { paymentMethod: 'CreditCard', categoryKey: 'Uncategorized', name: 'Livraria Papel e Tinta', ...NONE }],
    ['estorno de compra no débito', 'Estorno - Compra no débito - RIDEX *VIAGEM CENTRAL', { paymentMethod: 'DebitCard', categoryKey: 'Reversal', name: 'RIDEX *VIAGEM CENTRAL', ...NONE }],
    ['estorno de ajuste no débito', 'Estorno - Ajuste de compra no débito - RIDEX *VIAGEM CENTRAL', { paymentMethod: 'DebitCard', categoryKey: 'Reversal', name: 'RIDEX *VIAGEM CENTRAL', ...NONE }],
    ['estorno de compra no crédito', 'Estorno - Compra no crédito - Cinema Lumiere', { paymentMethod: 'CreditCard', categoryKey: 'Reversal', name: 'Cinema Lumiere', ...NONE }],
    ['estorno de ajuste no crédito', 'Estorno - Ajuste de compra no crédito - Cinema Lumiere', { paymentMethod: 'CreditCard', categoryKey: 'Reversal', name: 'Cinema Lumiere', ...NONE }],
    ['Pix recebida', `Transferência recebida pelo Pix - Vitor Hugo Siqueira - ${PIX_TAIL}`, { paymentMethod: 'PIX', categoryKey: 'Uncategorized', name: 'Vitor Hugo Siqueira', counterpartyDocument: '11.222.333/0001-81', counterpartyBank: 'BCO ALFA (0123)', status: 'new' }],
    ['Pix enviada', `Transferência enviada pelo Pix - Helena Braga Teixeira - ${PIX_TAIL}`, { paymentMethod: 'PIX', categoryKey: 'Uncategorized', name: 'Helena Braga Teixeira', counterpartyDocument: '11.222.333/0001-81', counterpartyBank: 'BCO ALFA (0123)', status: 'new' }],
    ['Transferência Recebida sem Pix', `Transferência Recebida - MARIA SOUZA LIMA LTDA - ${NU_TAIL}`, { paymentMethod: 'BankTransfer', categoryKey: 'Uncategorized', name: 'MARIA SOUZA LIMA LTDA', counterpartyDocument: '11.444.777/0001-62', counterpartyBank: 'NU PAGAMENTOS - IP (0260)', status: 'new' }],
    ['Transferência Enviada sem Pix', `Transferência Enviada - Oficina Torque ME - ${PIX_TAIL}`, { paymentMethod: 'BankTransfer', categoryKey: 'Uncategorized', name: 'Oficina Torque ME', counterpartyDocument: '11.222.333/0001-81', counterpartyBank: 'BCO ALFA (0123)', status: 'new' }],
    ['reembolso Pix', `Reembolso recebido pelo Pix - Estudio Pixel Arte LTDA - ${PIX_TAIL}`, { paymentMethod: 'PIX', categoryKey: 'Uncategorized', name: 'Estudio Pixel Arte LTDA', counterpartyDocument: '11.222.333/0001-81', counterpartyBank: 'BCO ALFA (0123)', status: 'new' }],
    ['boleto', 'Pagamento de boleto efetuado - ACADEMIA FORMA', { paymentMethod: 'Boleto', categoryKey: 'Uncategorized', name: 'ACADEMIA FORMA', ...NONE }],
    ['fatura', 'Pagamento de fatura', { paymentMethod: 'BankTransfer', categoryKey: 'Uncategorized', name: 'Pagamento de fatura', ...NONE }],
    ['débito em conta', 'Débito em conta', { paymentMethod: 'DebitCard', categoryKey: 'Uncategorized', name: 'Débito em conta', ...NONE }],
    ['dinheiro guardado', 'Dinheiro guardado com resgate planejado', { paymentMethod: 'BankTransfer', categoryKey: 'Investments', name: 'Dinheiro guardado com resgate planejado', ...NONE }],
  ];

  it.each(cases)('maps %s to method, category, name, document, bank and status', (_label, description, expected) => {
    expect(describeStatement(description)).toEqual(expected);
  });

  it('resolves "Compra no débito via NuPay - iFood" to NuPay, never DebitCard', () => {
    expect(describeStatement('Compra no débito via NuPay - iFood')).toMatchObject({ paymentMethod: 'NuPay', name: 'iFood' });
  });
});

describe('describeStatement: case, accent and space variants (IMPFIX-04, IMPFIX-05)', () => {
  it.each([
    ['COMPRA NO DEBITO - x', { paymentMethod: 'DebitCard', name: 'x' }],
    ['compra no debito via NUPAY - Loja Um', { paymentMethod: 'NuPay', name: 'Loja Um' }],
    ['Estorno - COMPRA no debito - Loja Dois', { paymentMethod: 'DebitCard', categoryKey: 'Reversal', name: 'Loja Dois' }],
    ['PAGAMENTO DE BOLETO EFETUADO - Escola Sul', { paymentMethod: 'Boleto', name: 'Escola Sul' }],
    ['debito em conta', { paymentMethod: 'DebitCard' }],
  ])('maps "%s" like the canonical prefix and keeps the case of the name', (description, expected) => {
    expect(describeStatement(description)).toMatchObject({ ...expected, status: 'new' });
  });

  it.each([
    [`transferencia RECEBIDA - Ana Lima - ${PIX_TAIL}`, 'BankTransfer', 'Ana Lima'],
    [`TRANSFERENCIA RECEBIDA PELO PIX - Ana Lima - ${PIX_TAIL}`, 'PIX', 'Ana Lima'],
    [`Transferencia enviada pelo pix - ana LIMA - ${PIX_TAIL}`, 'PIX', 'ana LIMA'],
  ])('maps the transfer "%s" like its canonical prefix', (description, paymentMethod, name) => {
    expect(describeStatement(description)).toMatchObject({ paymentMethod, name, status: 'new', counterpartyBank: 'BCO ALFA (0123)' });
  });

  it('collapses repeated spaces of a name into one and trims it, keeping the case', () => {
    expect(describeStatement('Compra no débito -   Padaria   Estrela  Azul  ').name).toBe('Padaria Estrela Azul');
    expect(describeStatement(`Transferência recebida pelo Pix - Vitor  Hugo   Siqueira - ${PIX_TAIL}`).name).toBe('Vitor Hugo Siqueira');
  });

  it('keeps a masked document as text and extracts the name', () => {
    expect(describeStatement('Transferência enviada pelo Pix - Maria Souza Lima - •••.381.754-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 1122334-5')).toMatchObject({
      name: 'Maria Souza Lima',
      counterpartyDocument: '•••.381.754-••',
      counterpartyBank: 'NU PAGAMENTOS - IP (0260)',
    });
  });
});

describe('describeStatement: unmapped and partial descriptions (IMPFIX-07)', () => {
  const unmapped = (name: string) => ({
    name,
    paymentMethod: 'Other',
    categoryKey: 'Uncategorized',
    counterpartyDocument: null,
    counterpartyBank: null,
    status: 'unrecognized',
  });

  it('returns Other, Uncategorized, the original text as the name and unrecognized for an unknown text', () => {
    expect(describeStatement('Qualquer coisa')).toEqual(unmapped('Qualquer coisa'));
  });

  it('does not collapse the spaces of an unmapped name', () => {
    expect(describeStatement('Qualquer   coisa  ')).toEqual(unmapped('Qualquer   coisa  '));
  });

  it('treats an Estorno of another kind as unmapped', () => {
    expect(describeStatement('Estorno - Pix - Fulano')).toEqual(unmapped('Estorno - Pix - Fulano'));
  });

  it('treats a transfer without NOME - DOC - BANCO Agência: as unmapped', () => {
    const text = 'Transferência enviada pelo Pix - Fulano de Tal';
    expect(describeStatement(text)).toEqual(unmapped(text));
    const noAgency = 'Transferência Recebida - Fulano - 11.222.333/0001-81 - BCO ALFA';
    expect(describeStatement(noAgency)).toEqual(unmapped(noAgency));
  });

  it('does not let an exact format swallow a longer text', () => {
    expect(describeStatement('Pagamento de fatura - Atrasada').status).toBe('unrecognized');
    expect(describeStatement('Débito em conta de luz').status).toBe('unrecognized');
  });

  it.each([
    ['Compra no débito', { paymentMethod: 'DebitCard' }],
    ['Pagamento de boleto efetuado', { paymentMethod: 'Boleto' }],
    ['Compra no crédito', { paymentMethod: 'CreditCard' }],
  ])('keeps the table method and uses the description as the name when "%s" has no " - X"', (description, expected) => {
    expect(describeStatement(description)).toMatchObject({ ...expected, name: description, status: 'new' });
  });

  it('keeps everything after the first " - " as the name of a purchase', () => {
    expect(describeStatement('Compra no débito - Casa - Filial 2 - Centro').name).toBe('Casa - Filial 2 - Centro');
    expect(describeStatement('Estorno - Compra no débito - Casa - Filial 2').name).toBe('Casa - Filial 2');
  });
});

describe('originalText (IMPFIX-06)', () => {
  it('collapses repeated spaces and tabs and trims the ends', () => {
    expect(originalText('  Compra no débito  -\tLoja   Um  ')).toBe('Compra no débito - Loja Um');
  });

  it('keeps a text of exactly 500 code points as is', () => {
    const text = 'a'.repeat(500);
    expect(originalText(text)).toBe(text);
  });

  it('cuts a text of 501 and of 600 code points to exactly 500', () => {
    expect(Array.from(originalText('b'.repeat(501)))).toHaveLength(500);
    expect(originalText('c'.repeat(600))).toBe('c'.repeat(500));
  });

  it('counts code points and never splits a surrogate pair', () => {
    const text = `${'a'.repeat(499)}😀tail`;
    const cut = originalText(text);
    expect(Array.from(cut)).toHaveLength(500);
    expect(cut.endsWith('😀')).toBe(true);
    const shifted = originalText(`${'a'.repeat(500)}😀`);
    expect(shifted).toBe('a'.repeat(500));
  });
});
