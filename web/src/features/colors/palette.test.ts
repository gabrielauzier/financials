import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCENT_CLASSES,
  BADGE_CLASSES,
  COLOR_FAMILIES,
  COLOR_KEYS,
  COLOR_SHADE,
  DEFAULT_COLOR,
  accentClasses,
  badgeClasses,
  colorLabel,
  isColorKey,
  type ColorKey,
} from "./palette";

const FAMILIES = [
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
];
describe("palette keys", () => {
  it("has 22 distinct keys, one per family, always shade 400, in family order", () => {
    expect([...COLOR_FAMILIES]).toEqual(FAMILIES);
    expect(COLOR_SHADE).toBe(400);
    expect(COLOR_KEYS).toHaveLength(22);
    expect(new Set(COLOR_KEYS).size).toBe(22);
    expect([...COLOR_KEYS]).toEqual(FAMILIES.map((f) => `${f}-400`));
  });

  it("matches the API order of the first and last keys and the default", () => {
    expect(COLOR_KEYS.slice(0, 3)).toEqual(["red-400", "orange-400", "amber-400"]);
    expect(COLOR_KEYS.at(-1)).toBe("stone-400");
    expect(DEFAULT_COLOR).toBe("slate-400");
  });

  it("accepts every key and rejects other shades, case, whitespace and unknown values", () => {
    for (const key of COLOR_KEYS) expect(isColorKey(key)).toBe(true);
    for (const value of [
      "",
      "blue",
      "blue-500",
      "blue-600",
      "blue-900",
      "Blue-400",
      " blue-400",
      "blue-400 ",
      "#60a5fa",
      undefined,
      null,
      5,
    ]) {
      expect(isColorKey(value)).toBe(false);
    }
  });
});

describe("colorLabel", () => {
  it("gives the 22 exact Portuguese family names, all distinct", () => {
    const labels = COLOR_KEYS.map(colorLabel);
    expect(labels).toEqual([
      "Vermelho",
      "Laranja",
      "Âmbar",
      "Amarelo",
      "Lima",
      "Verde",
      "Esmeralda",
      "Verde-azulado",
      "Ciano",
      "Céu",
      "Azul",
      "Índigo",
      "Violeta",
      "Roxo",
      "Fúcsia",
      "Rosa",
      "Rosê",
      "Ardósia",
      "Cinza",
      "Zinco",
      "Neutro",
      "Pedra",
    ]);
    expect(new Set(labels).size).toBe(22);
  });
});

function mapSource(name: string): string {
  const source = readFileSync(path.resolve(__dirname, "palette.ts"), "utf8");
  const start = source.indexOf(`export const ${name}`);
  const end = source.indexOf("\n};", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("BADGE_CLASSES and ACCENT_CLASSES", () => {
  it("badge: bg-<family>-200 and text-<family>-800 of the same family, for every key", () => {
    expect(Object.keys(BADGE_CLASSES).sort()).toEqual([...COLOR_KEYS].sort());
    for (const key of COLOR_KEYS) {
      const [family] = key.split("-");
      expect({ key, ...BADGE_CLASSES[key] }).toEqual({
        key,
        bg: `bg-${family}-200`,
        text: `text-${family}-800`,
      });
    }
  });

  it("accent: bg-<family>-400 (the stronger tone) for every key", () => {
    expect(Object.keys(ACCENT_CLASSES).sort()).toEqual([...COLOR_KEYS].sort());
    for (const key of COLOR_KEYS) {
      const [family] = key.split("-");
      expect({ key, ...ACCENT_CLASSES[key] }).toEqual({ key, bg: `bg-${family}-400` });
    }
  });

  it("both maps are written with literal class strings only (Tailwind generates only whole classes)", () => {
    const badge = mapSource("BADGE_CLASSES");
    const accent = mapSource("ACCENT_CLASSES");
    for (const block of [badge, accent]) {
      expect(block).not.toContain("${");
      expect(block).not.toContain("`");
    }
    expect(badge.match(/bg: "bg-[a-z]+-200"/g)).toHaveLength(22);
    expect(badge.match(/text: "text-[a-z]+-800"/g)).toHaveLength(22);
    expect(accent.match(/bg: "bg-[a-z]+-400"/g)).toHaveLength(22);
  });

  it("falls back to slate for an unknown value, undefined and the empty string", () => {
    for (const value of ["blue-500", "blue-600", "Blue-400", undefined, ""]) {
      expect(badgeClasses(value)).toEqual(BADGE_CLASSES["slate-400"]);
      expect(accentClasses(value)).toEqual(ACCENT_CLASSES["slate-400"]);
    }
    expect(badgeClasses("rose-400")).toEqual(BADGE_CLASSES["rose-400"]);
    expect(accentClasses("rose-400")).toEqual(ACCENT_CLASSES["rose-400"]);
  });
});

// Contrast, computed from the oklch values Tailwind ships, not from the palette's own classes.
const theme = readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8");

function oklchOf(name: string): [number, number, number] {
  const match = new RegExp(
    `--color-${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+|none)\\)`,
  ).exec(theme);
  if (!match) throw new Error(`theme.css has no oklch color ${name}`);
  return [Number(match[1]) / 100, Number(match[2]), match[3] === "none" ? 0 : Number(match[3])];
}

function luminance([l, c, h]: [number, number, number]): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function colorOf(utility: string): number {
  if (utility === "text-white") return 1;
  if (utility === "text-black") return 0;
  const name = utility.replace(/^(?:bg|text)-/, "");
  return luminance(oklchOf(name));
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("palette contrast", () => {
  it("reads the Tailwind theme (white on black is 21:1, a sanity check of the math)", () => {
    expect(contrast(1, 0)).toBeCloseTo(21, 5);
    expect(luminance(oklchOf("neutral-400"))).toBeGreaterThan(0.3);
  });

  it("sees the real ratios: 800 on 200 is high, 800 on 400 of red is low", () => {
    const ratio = (family: string, shade: number) =>
      contrast(colorOf(`bg-${family}-${shade}`), colorOf(`text-${family}-800`));
    expect(ratio("slate", 200)).toBeGreaterThan(7);
    expect(ratio("red", 400)).toBeLessThan(3);
  });

  it("holds 4.5:1 (WCAG AA) for text-800 on bg-200 in every one of the 22 families", () => {
    const ratios = COLOR_KEYS.map((key) => {
      const { bg, text } = BADGE_CLASSES[key];
      return { family: key.split("-")[0], ratio: contrast(colorOf(bg), colorOf(text)) };
    });
    expect(ratios).toHaveLength(22);
    expect(ratios.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
  });
});
