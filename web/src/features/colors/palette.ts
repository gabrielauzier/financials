/**
 * The color palette: 22 Tailwind families x shades 400, 600 and 900 (66 keys), the same list and
 * order as `api/src/lib/palette.ts` (a contract test compares it with `api/openapi.json`).
 * Colors travel as keys, never as hex values.
 */
export const COLOR_FAMILIES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
] as const;

export const COLOR_SHADES = [400, 600, 900] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];
export type ColorShade = (typeof COLOR_SHADES)[number];
export type ColorKey = `${ColorFamily}-${ColorShade}`;

/** Family by family, shade ascending. */
export const COLOR_KEYS: readonly ColorKey[] = COLOR_FAMILIES.flatMap((family) =>
  COLOR_SHADES.map((shade): ColorKey => `${family}-${shade}`),
);

export const DEFAULT_COLOR: ColorKey = "slate-600";

const KEY_SET: ReadonlySet<string> = new Set(COLOR_KEYS);

/** Exact match: no trim, no case folding. */
export function isColorKey(value: unknown): value is ColorKey {
  return typeof value === "string" && KEY_SET.has(value);
}

const FAMILY_NAMES: Record<ColorFamily, string> = {
  red: "Vermelho",
  orange: "Laranja",
  amber: "Âmbar",
  yellow: "Amarelo",
  lime: "Lima",
  green: "Verde",
  emerald: "Esmeralda",
  teal: "Verde-azulado",
  cyan: "Ciano",
  sky: "Céu",
  blue: "Azul",
  indigo: "Índigo",
  violet: "Violeta",
  purple: "Roxo",
  fuchsia: "Fúcsia",
  pink: "Rosa",
  rose: "Rosê",
  slate: "Ardósia",
  gray: "Cinza",
  zinc: "Zinco",
  neutral: "Neutro",
  stone: "Pedra",
};

/** Portuguese accessible name of a key, e.g. `Azul 600`. */
export function colorLabel(key: ColorKey): string {
  const [family, shade] = key.split("-") as [ColorFamily, string];
  return `${FAMILY_NAMES[family]} ${shade}`;
}

/**
 * Background and text classes of every key. The strings are literal on purpose: Tailwind only
 * generates classes that appear whole in the source, so never build them with a template string.
 * Text rule (contrast >= 4.5:1, checked against `tailwindcss/theme.css`): shade 400 uses the 950 of
 * its family, shade 900 uses white, shade 600 uses white or black depending on the family.
 */
export const COLOR_CLASSES: Record<ColorKey, { bg: string; text: string }> = {
  "red-400": { bg: "bg-red-400", text: "text-red-950" },
  "red-600": { bg: "bg-red-600", text: "text-white" },
  "red-900": { bg: "bg-red-900", text: "text-white" },
  "orange-400": { bg: "bg-orange-400", text: "text-orange-950" },
  "orange-600": { bg: "bg-orange-600", text: "text-black" },
  "orange-900": { bg: "bg-orange-900", text: "text-white" },
  "amber-400": { bg: "bg-amber-400", text: "text-amber-950" },
  "amber-600": { bg: "bg-amber-600", text: "text-black" },
  "amber-900": { bg: "bg-amber-900", text: "text-white" },
  "yellow-400": { bg: "bg-yellow-400", text: "text-yellow-950" },
  "yellow-600": { bg: "bg-yellow-600", text: "text-black" },
  "yellow-900": { bg: "bg-yellow-900", text: "text-white" },
  "lime-400": { bg: "bg-lime-400", text: "text-lime-950" },
  "lime-600": { bg: "bg-lime-600", text: "text-black" },
  "lime-900": { bg: "bg-lime-900", text: "text-white" },
  "green-400": { bg: "bg-green-400", text: "text-green-950" },
  "green-600": { bg: "bg-green-600", text: "text-black" },
  "green-900": { bg: "bg-green-900", text: "text-white" },
  "emerald-400": { bg: "bg-emerald-400", text: "text-emerald-950" },
  "emerald-600": { bg: "bg-emerald-600", text: "text-black" },
  "emerald-900": { bg: "bg-emerald-900", text: "text-white" },
  "teal-400": { bg: "bg-teal-400", text: "text-teal-950" },
  "teal-600": { bg: "bg-teal-600", text: "text-black" },
  "teal-900": { bg: "bg-teal-900", text: "text-white" },
  "cyan-400": { bg: "bg-cyan-400", text: "text-cyan-950" },
  "cyan-600": { bg: "bg-cyan-600", text: "text-black" },
  "cyan-900": { bg: "bg-cyan-900", text: "text-white" },
  "sky-400": { bg: "bg-sky-400", text: "text-sky-950" },
  "sky-600": { bg: "bg-sky-600", text: "text-black" },
  "sky-900": { bg: "bg-sky-900", text: "text-white" },
  "blue-400": { bg: "bg-blue-400", text: "text-blue-950" },
  "blue-600": { bg: "bg-blue-600", text: "text-white" },
  "blue-900": { bg: "bg-blue-900", text: "text-white" },
  "indigo-400": { bg: "bg-indigo-400", text: "text-indigo-950" },
  "indigo-600": { bg: "bg-indigo-600", text: "text-white" },
  "indigo-900": { bg: "bg-indigo-900", text: "text-white" },
  "violet-400": { bg: "bg-violet-400", text: "text-violet-950" },
  "violet-600": { bg: "bg-violet-600", text: "text-white" },
  "violet-900": { bg: "bg-violet-900", text: "text-white" },
  "purple-400": { bg: "bg-purple-400", text: "text-purple-950" },
  "purple-600": { bg: "bg-purple-600", text: "text-white" },
  "purple-900": { bg: "bg-purple-900", text: "text-white" },
  "fuchsia-400": { bg: "bg-fuchsia-400", text: "text-fuchsia-950" },
  "fuchsia-600": { bg: "bg-fuchsia-600", text: "text-white" },
  "fuchsia-900": { bg: "bg-fuchsia-900", text: "text-white" },
  "pink-400": { bg: "bg-pink-400", text: "text-pink-950" },
  "pink-600": { bg: "bg-pink-600", text: "text-white" },
  "pink-900": { bg: "bg-pink-900", text: "text-white" },
  "rose-400": { bg: "bg-rose-400", text: "text-rose-950" },
  "rose-600": { bg: "bg-rose-600", text: "text-white" },
  "rose-900": { bg: "bg-rose-900", text: "text-white" },
  "slate-400": { bg: "bg-slate-400", text: "text-slate-950" },
  "slate-600": { bg: "bg-slate-600", text: "text-white" },
  "slate-900": { bg: "bg-slate-900", text: "text-white" },
  "gray-400": { bg: "bg-gray-400", text: "text-gray-950" },
  "gray-600": { bg: "bg-gray-600", text: "text-white" },
  "gray-900": { bg: "bg-gray-900", text: "text-white" },
  "zinc-400": { bg: "bg-zinc-400", text: "text-zinc-950" },
  "zinc-600": { bg: "bg-zinc-600", text: "text-white" },
  "zinc-900": { bg: "bg-zinc-900", text: "text-white" },
  "neutral-400": { bg: "bg-neutral-400", text: "text-neutral-950" },
  "neutral-600": { bg: "bg-neutral-600", text: "text-white" },
  "neutral-900": { bg: "bg-neutral-900", text: "text-white" },
  "stone-400": { bg: "bg-stone-400", text: "text-stone-950" },
  "stone-600": { bg: "bg-stone-600", text: "text-white" },
  "stone-900": { bg: "bg-stone-900", text: "text-white" },
};

/** Classes of a key; an unknown value (a future API version) falls back to the default color. */
export function colorClasses(value: string | undefined): { bg: string; text: string } {
  return isColorKey(value) ? COLOR_CLASSES[value] : COLOR_CLASSES[DEFAULT_COLOR];
}
