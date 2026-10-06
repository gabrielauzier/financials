import { describe, expect, it } from 'vitest';
import { fixture } from '../../../test/helpers/fixtures.js';
import { AppError } from '../../plugins/errors.js';
import { assertBankMatches, detectFormat, parseByFormat, parseImport } from './formats.js';

function failure(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error('expected an AppError');
}

describe('detectFormat', () => {
  it('recognizes the account header', () => {
    expect(detectFormat(['Data', 'Valor', 'Identificador', 'Descrição'])).toBe('nubankAccount');
  });

  it('recognizes the invoice header', () => {
    expect(detectFormat(['date', 'title', 'amount'])).toBe('nubankInvoice');
  });

  it('returns null for an unknown, reordered, extended or differently-cased header', () => {
    expect(detectFormat(['foo', 'bar'])).toBeNull();
    expect(detectFormat([])).toBeNull();
    expect(detectFormat(['Valor', 'Data', 'Identificador', 'Descrição'])).toBeNull();
    expect(detectFormat(['Data', 'Valor', 'Identificador', 'Descrição', 'Extra'])).toBeNull();
    expect(detectFormat(['Date', 'Title', 'Amount'])).toBeNull();
  });
});

describe('assertBankMatches', () => {
  it('accepts both Nubank formats for a Nubank account', () => {
    expect(() => assertBankMatches('nubankAccount', 'Nubank')).not.toThrow();
    expect(() => assertBankMatches('nubankInvoice', 'Nubank')).not.toThrow();
  });

  it('raises bank_mismatch (422) for every other bank, for both formats', () => {
    for (const bank of ['SofisaDireto', 'Neon', 'XP', 'Other']) {
      for (const format of ['nubankAccount', 'nubankInvoice'] as const) {
        expect(failure(() => assertBankMatches(format, bank)), `${format}/${bank}`).toMatchObject({
          code: 'bank_mismatch',
          status: 422,
        });
      }
    }
  });
});

describe('parseByFormat', () => {
  it('dispatches to the account and invoice parsers', () => {
    expect(parseByFormat('nubankAccount', fixture('nubank_account.csv')).rows).toHaveLength(14);
    expect(parseByFormat('nubankInvoice', fixture('nubank_invoice.csv')).rows).toHaveLength(19);
  });
});

describe('parseImport (real samples)', () => {
  it('parses the account statement for a Nubank account', () => {
    const result = parseImport(fixture('nubank_account.csv'), 'Nubank');
    expect(result.format).toBe('nubankAccount');
    expect(result.rows).toHaveLength(14);
  });

  it('parses the invoice for a Nubank account', () => {
    const result = parseImport(fixture('nubank_invoice.csv'), 'Nubank');
    expect(result.format).toBe('nubankInvoice');
    expect(result.rows.filter((r) => r.status === 'new')).toHaveLength(18);
  });

  it('detects the format when the file has a BOM and CRLF', () => {
    const text = '﻿' + fixture('nubank_invoice.csv').replace(/\r?\n/g, '\r\n');
    expect(parseImport(text, 'Nubank').format).toBe('nubankInvoice');
  });

  it('raises bank_mismatch for a Nubank file on another bank account', () => {
    expect(failure(() => parseImport(fixture('nubank_account.csv'), 'XP'))).toMatchObject({
      code: 'bank_mismatch',
      status: 422,
    });
  });

  it('raises unsupported_format (422) for an unknown header', () => {
    expect(failure(() => parseImport('a,b,c\n1,2,3\n', 'Nubank'))).toMatchObject({
      code: 'unsupported_format',
      status: 422,
    });
  });

  it('raises empty_file (422) for empty and header-only files', () => {
    expect(failure(() => parseImport('', 'Nubank')).code).toBe('empty_file');
    expect(failure(() => parseImport('date,title,amount\n', 'Nubank'))).toMatchObject({
      code: 'empty_file',
      status: 422,
    });
  });
});
