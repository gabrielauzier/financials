import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COLOR_CLASSES,
  COLOR_FAMILIES,
  COLOR_KEYS,
  COLOR_SHADES,
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
const BLACK_TEXT_AT_600 = [
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
];
const split = (key: ColorKey) => key.split("-") as [string, string];

describe("palette keys", () => {
  it("has 66 distinct keys: 22 families times 400, 600 and 900, family by family", () => {
    expect([...COLOR_FAMILIES]).toEqual(FAMILIES);
    expect([...COLOR_SHADES]).toEqual([400, 600, 900]);
    expect(COLOR_KEYS).toHaveLength(66);
    expect(new Set(COLOR_KEYS).size).toBe(66);
    expect([...COLOR_KEYS]).toEqual(
      FAMILIES.flatMap((f) => [400, 600, 900].map((s) => `${f}-${s}`)),
    );
  });

  it("matches the API order of the first and last keys", () => {
    expect(COLOR_KEYS.slice(0, 4)).toEqual(["red-400", "red-600", "red-900", "orange-400"]);
    expect(COLOR_KEYS.at(-1)).toBe("stone-900");
    expect(DEFAULT_COLOR).toBe("slate-600");
  });

  it("accepts every key and rejects case, whitespace and unknown values", () => {
    for (const key of COLOR_KEYS) expect(isColorKey(key)).toBe(true);
    for (const value of [
      "",
      "blue",
      "blue-500",
      "Blue-600",
      " blue-600",
      "blue-600 ",
      "#2563eb",
      undefined,
      null,
      5,
    ]) {
      expect(isColorKey(value)).toBe(false);
    }
  });
});

describe("colorLabel", () => {
  it("gives 66 distinct Portuguese names", () => {
    const labels = COLOR_KEYS.map(colorLabel);
    expect(new Set(labels).size).toBe(66);
    expect(colorLabel("blue-600")).toBe("Azul 600");
    expect(colorLabel("teal-400")).toBe("Verde-azulado 400");
    expect(colorLabel("rose-900")).toBe("Rosê 900");
    expect(colorLabel("slate-600")).toBe("Ardósia 600");
    expect(colorLabel("stone-900")).toBe("Pedra 900");
  });
});

describe("COLOR_CLASSES", () => {
  it("has bg exactly bg-<family>-<shade> and the text of the rule, for every key", () => {
    expect(Object.keys(COLOR_CLASSES).sort()).toEqual([...COLOR_KEYS].sort());
    for (const key of COLOR_KEYS) {
      const [family, shade] = split(key);
      const text =
        shade === "400"
          ? `text-${family}-950`
          : shade === "900"
            ? "text-white"
            : BLACK_TEXT_AT_600.includes(family)
              ? "text-black"
              : "text-white";
      expect({ key, ...COLOR_CLASSES[key] }).toEqual({ key, bg: `bg-${family}-${shade}`, text });
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
    expect(block.match(/bg: "bg-[a-z]+-(400|600|900)"/g)).toHaveLength(66);
  });

  it("falls back to slate-600 for an unknown value, undefined and the empty string", () => {
    const fallback = COLOR_CLASSES["slate-600"];
    for (const value of ["blue-500", "Blue-600", undefined, ""]) {
      expect(colorClasses(value)).toEqual(fallback);
    }
    expect(colorClasses("rose-900")).toEqual(COLOR_CLASSES["rose-900"]);
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

  it("is at least 4.5:1 for text on background in every one of the 66 entries", () => {
    const low: string[] = [];
    for (const key of COLOR_KEYS) {
      const { bg, text } = COLOR_CLASSES[key];
      const ratio = contrast(colorOf(bg), colorOf(text));
      if (ratio < 4.5) low.push(`${key}: ${ratio.toFixed(2)}`);
    }
    expect(low).toEqual([]);
  });
});
