/** The color palette: 22 Tailwind families x shades 400, 600 and 900. Colors are stored as keys, never as hex. */
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

export const COLOR_SHADES = [400, 600, 900] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];
export type ColorShade = (typeof COLOR_SHADES)[number];
export type ColorKey = `${ColorFamily}-${ColorShade}`;

/** Family by family, shade ascending (the same order as the web palette). */
export const COLOR_KEYS: readonly ColorKey[] = COLOR_FAMILIES.flatMap((family) =>
  COLOR_SHADES.map((shade): ColorKey => `${family}-${shade}`),
);

export const DEFAULT_COLOR: ColorKey = 'slate-600';

const KEY_SET: ReadonlySet<string> = new Set(COLOR_KEYS);

/** Exact match: no trim, no case folding. */
export function isColorKey(value: string): value is ColorKey {
  return KEY_SET.has(value);
}
