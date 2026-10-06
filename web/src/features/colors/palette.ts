/**
 * The color palette: one key per Tailwind family (22 keys, always written `<family>-400`; the shade suffix is only an identifier now, the tone shown is set by the class maps below), the same list and
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

export const COLOR_SHADE = 400;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];
export type ColorKey = `${ColorFamily}-${typeof COLOR_SHADE}`;

/** In family order. */
export const COLOR_KEYS: readonly ColorKey[] = COLOR_FAMILIES.map(
  (family): ColorKey => `${family}-${COLOR_SHADE}`,
);

export const DEFAULT_COLOR: ColorKey = "slate-400";

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

/** Portuguese accessible name of a key: the name of its family, e.g. `Azul` (there is one shade). */
export function colorLabel(key: ColorKey): string {
  const [family] = key.split("-") as [ColorFamily];
  return FAMILY_NAMES[family];
}

/**
 * Class maps. The strings are literal on purpose: Tailwind only generates classes that appear whole
 * in the source, so never build them with a template string.
 * `BADGE_CLASSES`: category badges and the picker swatches (light tone): background
 * `bg-<family>-200`, text `text-<family>-800` (800 on 200 reaches 4.5:1 in all 22 families,
 * asserted in `palette.test.ts`).
 * `ACCENT_CLASSES`: dots, bars and frames next to account names: the stronger `bg-<family>-400`.
 */
export const BADGE_CLASSES: Record<ColorKey, { bg: string; text: string }> = {
  "red-400": { bg: "bg-red-200", text: "text-red-800" },
  "orange-400": { bg: "bg-orange-200", text: "text-orange-800" },
  "amber-400": { bg: "bg-amber-200", text: "text-amber-800" },
  "yellow-400": { bg: "bg-yellow-200", text: "text-yellow-800" },
  "lime-400": { bg: "bg-lime-200", text: "text-lime-800" },
  "green-400": { bg: "bg-green-200", text: "text-green-800" },
  "emerald-400": { bg: "bg-emerald-200", text: "text-emerald-800" },
  "teal-400": { bg: "bg-teal-200", text: "text-teal-800" },
  "cyan-400": { bg: "bg-cyan-200", text: "text-cyan-800" },
  "sky-400": { bg: "bg-sky-200", text: "text-sky-800" },
  "blue-400": { bg: "bg-blue-200", text: "text-blue-800" },
  "indigo-400": { bg: "bg-indigo-200", text: "text-indigo-800" },
  "violet-400": { bg: "bg-violet-200", text: "text-violet-800" },
  "purple-400": { bg: "bg-purple-200", text: "text-purple-800" },
  "fuchsia-400": { bg: "bg-fuchsia-200", text: "text-fuchsia-800" },
  "pink-400": { bg: "bg-pink-200", text: "text-pink-800" },
  "rose-400": { bg: "bg-rose-200", text: "text-rose-800" },
  "slate-400": { bg: "bg-slate-200", text: "text-slate-800" },
  "gray-400": { bg: "bg-gray-200", text: "text-gray-800" },
  "zinc-400": { bg: "bg-zinc-200", text: "text-zinc-800" },
  "neutral-400": { bg: "bg-neutral-200", text: "text-neutral-800" },
  "stone-400": { bg: "bg-stone-200", text: "text-stone-800" },
};

export const ACCENT_CLASSES: Record<ColorKey, { bg: string }> = {
  "red-400": { bg: "bg-red-400" },
  "orange-400": { bg: "bg-orange-400" },
  "amber-400": { bg: "bg-amber-400" },
  "yellow-400": { bg: "bg-yellow-400" },
  "lime-400": { bg: "bg-lime-400" },
  "green-400": { bg: "bg-green-400" },
  "emerald-400": { bg: "bg-emerald-400" },
  "teal-400": { bg: "bg-teal-400" },
  "cyan-400": { bg: "bg-cyan-400" },
  "sky-400": { bg: "bg-sky-400" },
  "blue-400": { bg: "bg-blue-400" },
  "indigo-400": { bg: "bg-indigo-400" },
  "violet-400": { bg: "bg-violet-400" },
  "purple-400": { bg: "bg-purple-400" },
  "fuchsia-400": { bg: "bg-fuchsia-400" },
  "pink-400": { bg: "bg-pink-400" },
  "rose-400": { bg: "bg-rose-400" },
  "slate-400": { bg: "bg-slate-400" },
  "gray-400": { bg: "bg-gray-400" },
  "zinc-400": { bg: "bg-zinc-400" },
  "neutral-400": { bg: "bg-neutral-400" },
  "stone-400": { bg: "bg-stone-400" },
};

/** Badge classes of a key; an unknown value (a future API version) falls back to the default color. */
export function badgeClasses(value: string | undefined): { bg: string; text: string } {
  return isColorKey(value) ? BADGE_CLASSES[value] : BADGE_CLASSES[DEFAULT_COLOR];
}

/** Accent classes of a key; an unknown value falls back to the default color. */
export function accentClasses(value: string | undefined): { bg: string } {
  return isColorKey(value) ? ACCENT_CLASSES[value] : ACCENT_CLASSES[DEFAULT_COLOR];
}
