import { describe, expect, it } from 'vitest';
import { COLOR_FAMILIES, COLOR_KEYS, COLOR_SHADE, DEFAULT_COLOR, isColorKey } from './palette.js';

describe('palette', () => {
  it('has 22 families and the single shade 400', () => {
    expect(COLOR_FAMILIES).toHaveLength(22);
    expect(COLOR_SHADE).toBe(400);
  });

  it('lists 22 distinct keys of the form family-400', () => {
    expect(COLOR_KEYS).toHaveLength(22);
    expect(new Set(COLOR_KEYS).size).toBe(22);
    for (const key of COLOR_KEYS) expect(key).toMatch(/^[a-z]+-400$/);
  });

  it('keeps the family order', () => {
    expect(COLOR_KEYS.slice(0, 3)).toEqual(['red-400', 'orange-400', 'amber-400']);
    expect(COLOR_KEYS.at(-1)).toBe('stone-400');
  });

  it('has a default color that is in the list', () => {
    expect(DEFAULT_COLOR).toBe('slate-400');
    expect(COLOR_KEYS).toContain(DEFAULT_COLOR);
  });

  it('accepts every key', () => {
    for (const key of COLOR_KEYS) expect(isColorKey(key)).toBe(true);
  });

  it.each(['', 'blue', 'blue-500', 'blue-600', 'blue-900', 'Blue-400', ' blue-400', 'blue-400 ', '#60a5fa'])(
    'rejects %j',
    (value) => {
      expect(isColorKey(value)).toBe(false);
    },
  );
});
