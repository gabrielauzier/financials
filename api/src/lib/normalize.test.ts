import { describe, expect, it } from 'vitest';
import { collapseSpaces, normalizeName } from './normalize.js';

describe('normalizeName', () => {
  it('maps accents, case and repeated spaces to the same string', () => {
    const expected = normalizeName('joao da silva');
    expect(normalizeName('João   da  SILVA')).toBe(expected);
    expect(normalizeName('  JOÃO DA Silva ')).toBe(expected);
    expect(expected).toBe('joao da silva');
  });

  it('strips diacritics such as cedilla, tilde and circumflex', () => {
    expect(normalizeName('Conceição Açaí Êxito')).toBe('conceicao acai exito');
  });

  it('returns an empty string for empty and whitespace-only input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   \t  ')).toBe('');
  });
});

describe('collapseSpaces', () => {
  it('trims and collapses runs of whitespace but keeps case and accents', () => {
    expect(collapseSpaces('  João   da  Silva ')).toBe('João da Silva');
    expect(collapseSpaces('')).toBe('');
  });
});
