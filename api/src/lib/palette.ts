/** The color palette: one key per Tailwind family, always shade 400 (22 keys). Colors are stored as keys, never as hex. */
export const COLOR_FAMILIES = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
] as const;

export const COLOR_SHADE = 400;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];
export type ColorKey = `${ColorFamily}-${typeof COLOR_SHADE}`;

/** In family order (the same order as the web palette). */
export const COLOR_KEYS: readonly ColorKey[] = COLOR_FAMILIES.map(
  (family): ColorKey => `${family}-${COLOR_SHADE}`,
);

export const DEFAULT_COLOR: ColorKey = 'slate-400';

const KEY_SET: ReadonlySet<string> = new Set(COLOR_KEYS);

/** Exact match: no trim, no case folding. */
export function isColorKey(value: string): value is ColorKey {
  return KEY_SET.has(value);
}
