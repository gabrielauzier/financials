import { describe, expect, it } from 'vitest';
import { AppError } from '../../plugins/errors.js';
import { readCsv } from './csv.js';

const BOM = '﻿';

function emptyFile(fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'empty_file', status: 422 });
    return;
  }
  throw new Error('expected an empty_file error');
}

describe('readCsv', () => {
  it('parses header and records as raw strings', () => {
    expect(readCsv('a,b\n1,2\n3,4\n')).toEqual({
      header: ['a', 'b'],
      records: [
        ['1', '2'],
        ['3', '4'],
      ],
    });
  });

  it('parses a file with a BOM identically to one without', () => {
    const text = 'Data,Valor\n02/07/2026,-82.32\n';
    expect(readCsv(BOM + text)).toEqual(readCsv(text));
    expect(readCsv(BOM + text).header[0]).toBe('Data');
  });

  it('parses Windows line endings like Unix ones', () => {
    const unix = 'a,b\n1,2\n3,4\n';
    expect(readCsv(unix.replace(/\n/g, '\r\n'))).toEqual(readCsv(unix));
  });

  it('keeps quoted fields with commas and decimal commas untouched', () => {
    const csv = readCsv('date,title,amount\n2026-09-14,"Loja, Centro","1.335,61"\n2026-09-14,X,"- 1.335,61"\n');
    expect(csv.records).toEqual([
      ['2026-09-14', 'Loja, Centro', '1.335,61'],
      ['2026-09-14', 'X', '- 1.335,61'],
    ]);
  });

  it('does not abort on a row with fewer columns than the header', () => {
    expect(readCsv('a,b,c\n1,2\n').records).toEqual([['1', '2']]);
  });

  it('skips blank lines between records', () => {
    expect(readCsv('a\n1\n\n2\n').records).toEqual([['1'], ['2']]);
  });

  it('raises empty_file for an empty string', () => {
    emptyFile(() => readCsv(''));
  });

  it('raises empty_file for a BOM only or whitespace-free blank lines', () => {
    emptyFile(() => readCsv(BOM));
    emptyFile(() => readCsv('\n\n'));
  });

  it('raises empty_file for a header-only file', () => {
    emptyFile(() => readCsv('Data,Valor,Identificador,Descrição\n'));
    emptyFile(() => readCsv('Data,Valor,Identificador,Descrição'));
  });

  it('raises empty_file for a header-only file with a BOM and CRLF', () => {
    emptyFile(() => readCsv(`${BOM}date,title,amount\r\n`));
  });

  it('raises unsupported_format (422) for an unterminated quote', () => {
    expect(() => readCsv('a,b\n"1,2\n')).toThrowError(
      expect.objectContaining({ code: 'unsupported_format', status: 422 }) as Error,
    );
  });
});
