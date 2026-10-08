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

  it('recognizes both Sofisa Direto headers: 3 columns (CSV) and 4 columns with an empty third (TSV)', () => {
    expect(detectFormat(['Data', 'Descrição', 'Valor'])).toBe('sofisaAccount');
    expect(detectFormat(['Data', 'Descrição', '', 'Valor'])).toBe('sofisaAccount');
  });

  it('returns null for near-miss Sofisa headers', () => {
    expect(detectFormat(['Data', 'Valor', 'Descrição'])).toBeNull();
    expect(detectFormat(['Data', 'Descrição', ' ', 'Valor'])).toBeNull();
    expect(detectFormat(['Data', 'Descrição', 'Valor', ''])).toBeNull();
    expect(detectFormat(['Data', 'Descricao', 'Valor'])).toBeNull();
    expect(detectFormat(['data', 'descrição', 'valor'])).toBeNull();
  });

  it('recognizes the Notion header exactly, and not a near miss', () => {
    const header = ['Name', 'Type', 'Date', 'Amount', 'Category', 'Payment Method', 'Notes', 'Receipt', 'Created time', 'ID', 'Identifier'];
    expect(detectFormat(header)).toBe('notion');
    expect(detectFormat(header.slice(0, 10))).toBeNull();
    expect(detectFormat([...header, 'Extra'])).toBeNull();
    expect(detectFormat(header.map((c) => c.toLowerCase()))).toBeNull();
    expect(detectFormat([...header.slice(0, 9), 'Identifier', 'ID'])).toBeNull();
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
  it('accepts the Sofisa format only for a SofisaDireto account', () => {
    expect(() => assertBankMatches('sofisaAccount', 'SofisaDireto')).not.toThrow();
    for (const bank of ['Nubank', 'Neon', 'XP', 'Other']) {
      expect(failure(() => assertBankMatches('sofisaAccount', bank)), bank).toMatchObject({
        code: 'bank_mismatch',
        status: 422,
      });
    }
  });

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

describe('assertBankMatches (Notion)', () => {
  it('is not bank-specific: every bank accepts it', () => {
    for (const bank of ['Nubank', 'SofisaDireto', 'Neon', 'XP', 'Other']) {
      expect(() => assertBankMatches('notion', bank), bank).not.toThrow();
    }
  });
});

describe('parseByFormat', () => {
  it('dispatches to the Sofisa parser', () => {
    expect(parseByFormat('sofisaAccount', fixture('sofisa_statement_sanitized.csv')).rows).toHaveLength(18);
  });

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

describe('parseImport (Notion)', () => {
  it.each(['Nubank', 'SofisaDireto', 'Neon', 'XP', 'Other'])('parses the Notion model for a %s account', (bank) => {
    const result = parseImport(fixture('notion_sanitized.csv'), bank);
    expect(result.format).toBe('notion');
    expect(result.rows).toHaveLength(27);
  });

  it('still raises bank_mismatch for the bank-specific formats', () => {
    expect(failure(() => parseImport(fixture('nubank_account.csv'), 'XP')).code).toBe('bank_mismatch');
    expect(failure(() => parseImport(fixture('sofisa_statement_sanitized.csv'), 'Nubank')).code).toBe('bank_mismatch');
  });

  it('raises empty_file for a header-only Notion file', () => {
    const header = 'Name,Type,Date,Amount,Category,Payment Method,Notes,Receipt,Created time,ID,Identifier\n';
    expect(failure(() => parseImport(header, 'Nubank')).code).toBe('empty_file');
  });

  it('lists Notion among the formats of unsupported_format', () => {
    const error = failure(() => parseImport('a,b,c\n1,2,3\n', 'Nubank'));
    expect(error.code).toBe('unsupported_format');
    expect(error.message).toMatch(/Notion/);
  });
});

describe('parseImport (Sofisa Direto)', () => {
  it.each(['sofisa_statement_sanitized.csv', 'sofisa_statement_sanitized.tsv'])('parses %s for a SofisaDireto account', (name) => {
    const result = parseImport(fixture(name), 'SofisaDireto');
    expect(result.format).toBe('sofisaAccount');
    expect(result.rows).toHaveLength(18);
    expect(result.rows.filter((r) => r.status === 'ignored')).toHaveLength(5);
  });

  it('gives the same rows for the CSV and the TSV', () => {
    expect(parseImport(fixture('sofisa_statement_sanitized.tsv'), 'SofisaDireto')).toEqual(
      parseImport(fixture('sofisa_statement_sanitized.csv'), 'SofisaDireto'),
    );
  });

  it('raises bank_mismatch when a Sofisa file goes to a Nubank account and the other way round', () => {
    for (const name of ['sofisa_statement_sanitized.csv', 'sofisa_statement_sanitized.tsv']) {
      expect(failure(() => parseImport(fixture(name), 'Nubank')), name).toMatchObject({ code: 'bank_mismatch', status: 422 });
    }
    expect(failure(() => parseImport(fixture('nubank_account.csv'), 'SofisaDireto'))).toMatchObject({
      code: 'bank_mismatch',
      status: 422,
    });
    expect(failure(() => parseImport(fixture('nubank_invoice.csv'), 'SofisaDireto')).code).toBe('bank_mismatch');
  });

  it('raises empty_file for a header-only Sofisa file', () => {
    expect(failure(() => parseImport('Data;Descrição;Valor\n', 'SofisaDireto')).code).toBe('empty_file');
    expect(failure(() => parseImport('Data\tDescrição\t\tValor\n', 'SofisaDireto')).code).toBe('empty_file');
  });

  it('names the accepted formats in unsupported_format instead of only Nubank', () => {
    const error = failure(() => parseImport('a;b;c\n1;2;3\n', 'SofisaDireto'));
    expect(error).toMatchObject({ code: 'unsupported_format', status: 422 });
    expect(error.message).toMatch(/Sofisa/);
    expect(error.message).toMatch(/Nubank/);
  });
});
