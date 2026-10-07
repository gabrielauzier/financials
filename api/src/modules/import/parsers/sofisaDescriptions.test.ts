import { describe, expect, it } from 'vitest';
import { describeSofisa, isBalanceLine } from './sofisaDescriptions.js';

describe('describeSofisa', () => {
  it.each([
    ['IOF Limite Especial', 'Other', 'Uncategorized'],
    ['Juros Limite Especial', 'Other', 'Uncategorized'],
    ['PAGTO FATURA CARTAO DE CRED', 'BankTransfer', 'Uncategorized'],
    ['Cashback - Cartao Sofisa Visa', 'Other', 'Uncategorized'],
    ['Aplicação - Fundo X - CDB DIRETO DI', 'BankTransfer', 'Investments'],
    ['Recebimento de transferência via PIX - De Ana Teste', 'PIX', 'Uncategorized'],
  ] as const)('maps "%s" to %s / %s as a known format', (text, method, category) => {
    expect(describeSofisa(text)).toMatchObject({ paymentMethod: method, categoryKey: category, status: 'new' });
  });

  it('names a Pix by the sender after "De ", keeping its case and accents', () => {
    expect(describeSofisa('Recebimento de transferência via PIX - De JOÃO DA SILVA ME').name).toBe('JOÃO DA SILVA ME');
    expect(describeSofisa('Recebimento de transferência via PIX - De Ana - Filial').name).toBe('Ana - Filial');
  });

  it('matches the prefix without caring about case, accents or repeated spaces', () => {
    expect(describeSofisa('recebimento de transferencia via pix - De Ana')).toMatchObject({ name: 'Ana', paymentMethod: 'PIX' });
    expect(describeSofisa('  iof   limite  especial ')).toMatchObject({ name: 'iof limite especial', status: 'new' });
    expect(describeSofisa('APLICACAO - x - cdb')).toMatchObject({ categoryKey: 'Investments', status: 'new' });
  });

  it('treats a Pix without a sender, or an investment without CDB, as unrecognized', () => {
    expect(describeSofisa('Recebimento de transferência via PIX')).toMatchObject({ status: 'unrecognized', paymentMethod: 'Other' });
    expect(describeSofisa('Recebimento de transferência via PIX - De ')).toMatchObject({ status: 'unrecognized' });
    expect(describeSofisa('Recebimento de transferência via PIX - Ana')).toMatchObject({ status: 'unrecognized' });
    expect(describeSofisa('Aplicação - Fundo X')).toMatchObject({ status: 'unrecognized', categoryKey: 'Uncategorized' });
    expect(describeSofisa('Aplicação - Fundo cdbx')).toMatchObject({ status: 'unrecognized' });
  });

  it('requires an exact match for the fixed formats', () => {
    expect(describeSofisa('IOF Limite Especial - ajuste').status).toBe('unrecognized');
    expect(describeSofisa('Juros Limite').status).toBe('unrecognized');
    expect(describeSofisa('PAGTO FATURA CARTAO DE CRED 2').status).toBe('unrecognized');
    expect(describeSofisa('Cashback - Cartao Sofisa').status).toBe('unrecognized');
  });

  it('does not invent formats: unseen texts stay Other / Uncategorized / unrecognized', () => {
    for (const text of ['Envio de transferência via PIX - Para Ana', 'Resgate CDB', 'Tarifa mensal', 'PIX enviado']) {
      expect(describeSofisa(text), text).toMatchObject({
        paymentMethod: 'Other',
        categoryKey: 'Uncategorized',
        status: 'unrecognized',
        name: text,
      });
    }
  });
});

describe('isBalanceLine', () => {
  it('accepts only "Saldo em dd/mm/aaaa" (case, accents and spacing ignored)', () => {
    expect(isBalanceLine('Saldo em 04/11/2025')).toBe(true);
    expect(isBalanceLine(' saldo  EM 04/11/2025 ')).toBe(true);
    for (const text of ['Saldo em 4/11/2025', 'Saldo em 04/11/25', 'Saldo 04/11/2025', 'Saldo em 04/11/2025 x', 'x Saldo em 04/11/2025', 'Saldo em hoje']) {
      expect(isBalanceLine(text), text).toBe(false);
    }
  });
});
