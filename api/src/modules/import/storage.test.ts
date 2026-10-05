import { describe, expect, it } from 'vitest';
import { safeFilename } from './storage.js';

describe('safeFilename', () => {
  it('keeps a plain name', () => {
    expect(safeFilename('extrato_nubank-2026.07.csv')).toBe('extrato_nubank-2026.07.csv');
  });

  it('drops directories of both separators', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('a/b.csv')).toBe('b.csv');
    expect(safeFilename('C:\\tmp\\fatura.csv')).toBe('fatura.csv');
  });

  it('drops control characters and replaces other unsafe characters with _', () => {
    expect(safeFilename('ex\u0000tra\u001fto\u007f.csv')).toBe('extrato.csv');
    expect(safeFilename('fatura março?.csv')).toBe('fatura_mar_o_.csv');
  });

  it('removes leading dots so the name is never . or .. or hidden', () => {
    expect(safeFilename('..')).toBe('import.csv');
    expect(safeFilename('.')).toBe('import.csv');
    expect(safeFilename('.env')).toBe('env');
  });

  it('falls back to import.csv when nothing is left', () => {
    expect(safeFilename('')).toBe('import.csv');
    expect(safeFilename('dir/')).toBe('import.csv');
    expect(safeFilename('\u0001\u0002')).toBe('import.csv');
  });

  it('caps the name at 100 characters keeping the extension', () => {
    const name = safeFilename(`${'a'.repeat(300)}.csv`);
    expect(name).toHaveLength(100);
    expect(name).toBe(`${'a'.repeat(96)}.csv`);
  });
});
