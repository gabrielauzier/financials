import { describe, expect, it } from 'vitest';
import { COLOR_FAMILIES, COLOR_KEYS, COLOR_SHADES, DEFAULT_COLOR, isColorKey } from './palette.js';

describe('palette', () => {
  it('has 22 families and 3 shades', () => {
    expect(COLOR_FAMILIES).toHaveLength(22);
    expect([...COLOR_SHADES]).toEqual([400, 600, 900]);
  });

  it('lists 66 distinct keys of the form family-shade', () => {
    expect(COLOR_KEYS).toHaveLength(66);
    expect(new Set(COLOR_KEYS).size).toBe(66);
    for (const key of COLOR_KEYS) expect(key).toMatch(/^[a-z]+-(400|600|900)$/);
  });

  it('orders keys family by family with ascending shades', () => {
    expect(COLOR_KEYS.slice(0, 4)).toEqual(['red-400', 'red-600', 'red-900', 'orange-400']);
    expect(COLOR_KEYS.at(-1)).toBe('stone-900');
  });

  it('has a default color that is in the list', () => {
    expect(DEFAULT_COLOR).toBe('slate-600');
    expect(COLOR_KEYS).toContain(DEFAULT_COLOR);
  });

  it('accepts every key', () => {
    for (const key of COLOR_KEYS) expect(isColorKey(key)).toBe(true);
  });

  it.each(['', 'blue', 'blue-500', 'Blue-600', ' blue-600', 'blue-600 ', '#2563eb'])(
    'rejects %j',
    (value) => {
      expect(isColorKey(value)).toBe(false);
    },
  );
});
