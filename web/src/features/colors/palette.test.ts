import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COLOR_CLASSES,
  COLOR_FAMILIES,
  COLOR_KEYS,
  COLOR_SHADE,
  DEFAULT_COLOR,
  colorClasses,
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

describe("COLOR_CLASSES", () => {
  it("has bg-<family>-400 and text-<family>-800 of the same family, for every key", () => {
    expect(Object.keys(COLOR_CLASSES).sort()).toEqual([...COLOR_KEYS].sort());
    for (const key of COLOR_KEYS) {
      const [family] = key.split("-");
      expect({ key, ...COLOR_CLASSES[key] }).toEqual({
        key,
        bg: `bg-${family}-400`,
        text: `text-${family}-800`,
      });
    }
  });

  it("is written with literal class strings only (Tailwind generates only whole classes)", () => {
    const source = readFileSync(path.resolve(__dirname, "palette.ts"), "utf8");
    const start = source.indexOf("export const COLOR_CLASSES");
    const end = source.indexOf("\n};", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    expect(block).not.toContain("${");
    expect(block).not.toContain("`");
    expect(block.match(/bg: "bg-[a-z]+-400"/g)).toHaveLength(22);
    expect(block.match(/text: "text-[a-z]+-800"/g)).toHaveLength(22);
  });

  it("falls back to slate-400 for an unknown value, undefined and the empty string", () => {
    const fallback = COLOR_CLASSES["slate-400"];
    for (const value of ["blue-500", "blue-600", "Blue-400", undefined, ""]) {
      expect(colorClasses(value)).toEqual(fallback);
    }
    expect(colorClasses("rose-400")).toEqual(COLOR_CLASSES["rose-400"]);
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

/** Families whose 800 on 400 is below 4.5:1 with the Tailwind v4 theme (see spec COLOR-02, known deviation). */
const KNOWN_LOW_CONTRAST_FAMILIES = [
  "red",
  "orange",
  "amber",
  "yellow",
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
];

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("palette contrast", () => {
  it("reads the Tailwind theme (white on black is 21:1, a sanity check of the math)", () => {
    expect(contrast(1, 0)).toBeCloseTo(21, 5);
    expect(luminance(oklchOf("neutral-400"))).toBeGreaterThan(0.3);
  });

  it("sees the real ratios: slate 800 on 400 passes and red 800 on 400 does not", () => {
    const ratio = (family: string) =>
      contrast(colorOf(`bg-${family}-400`), colorOf(`text-${family}-800`));
    expect(ratio("slate")).toBeGreaterThan(5);
    expect(ratio("red")).toBeLessThan(3);
  });

  it("holds 4.5:1 (WCAG AA, threshold unchanged) for text-800 on bg-400 except the known deviation", () => {
    const failing = COLOR_KEYS.filter((key) => {
      const { bg, text } = COLOR_CLASSES[key];
      return contrast(colorOf(bg), colorOf(text)) < 4.5;
    }).map((key) => key.split("-")[0]);
    // Owner mandate: text-800 on bg-400 of the same family. These families do not reach 4.5:1
    // with it; the list is asserted both ways so it can neither hide a new failure nor go stale.
    expect(failing).toEqual(KNOWN_LOW_CONTRAST_FAMILIES);
  });
});
