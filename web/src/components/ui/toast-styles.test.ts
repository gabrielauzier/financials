import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, luminance, parseOklch, type Oklch } from "@/test/colorContrast";
import { toastClassNames } from "./toast-styles";

/** A class that sets a color (background, text or border), with or without variants and the `!` suffix. */
const COLOR_CLASS = /(?:^|:)(?:bg|text|border)-[^\s:]+$/;
const classesOf = (key: keyof typeof toastClassNames) => toastClassNames[key].split(/\s+/);

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const tailwindTheme = read("../../../node_modules/tailwindcss/theme.css");
const appStyles = read("../../styles.css");

type Theme = "light" | "dark";
type Type = "success" | "error" | "info";
const TYPES: Type[] = ["success", "error", "info"];
const THEMES: Theme[] = ["light", "dark"];

const declaration = (css: string, name: string): string | undefined =>
  new RegExp(`${name}:\\s*(oklch\\([^)]*\\))\\s*;`).exec(css)?.[1];
const block = (selector: RegExp): string => selector.exec(appStyles)?.[1] ?? "";
const appBlocks = { light: block(/:root\s*\{([^}]*)\}/), dark: block(/\.dark\s*\{([^}]*)\}/) };

/** A theme token as the app defines it (`background`), the dark block falling back to `:root`. */
const appToken = (name: string, theme: Theme): Oklch => {
  const value =
    declaration(appBlocks[theme], `--${name}`) ?? declaration(appBlocks.light, `--${name}`);
  if (!value) throw new Error(`--${name} is not defined in styles.css`);
  return parseOklch(value);
};
/** The color a class token such as `emerald-50` or `background` stands for. */
const colorOf = (token: string, theme: Theme): Oklch => {
  const palette = declaration(tailwindTheme, `--color-${token}`);
  return palette ? parseOklch(palette) : appToken(token, theme);
};

/** Background and text of a toast type in a theme, resolved from its classes (`dark:` ones only in the dark theme and winning there). */
function resolve(type: Type, theme: Theme): { background: Oklch; text: Oklch } {
  const picked: Record<string, string> = {};
  const classes = classesOf(type);
  const wanted = theme === "dark" ? [false, true] : [false];
  for (const darkPass of wanted) {
    for (const name of classes.filter((item) => item.startsWith("dark:") === darkPass)) {
      const match = /^(bg|text)-(.+)$/.exec(
        name
          .replace(/^dark:/, "")
          .replace("group-[.toaster]:", "")
          .replace(/!$/, ""),
      );
      if (match) picked[match[1] as string] = match[2] as string;
    }
  }
  if (!picked["bg"] || !picked["text"]) throw new Error(`${type} has no bg/text class in ${theme}`);
  return { background: colorOf(picked["bg"], theme), text: colorOf(picked["text"], theme) };
}

const inRange = (hue: number, from: number, to: number) => hue >= from && hue <= to;
/** Hue distance on the color wheel, 0 to 180. */
const hueGap = (first: number, second: number) => {
  const gap = Math.abs(first - second) % 360;
  return gap > 180 ? 360 - gap : gap;
};

describe("as classes de cor dos toasts vencem o CSS sem camada do sonner", () => {
  // Tailwind v4 puts utilities in `@layer utilities`; sonner's rules are unlayered and win unless the
  // utility is important (`!` suffix). jsdom cannot see the cascade, so the guard is on the class text.
  const keys = Object.keys(toastClassNames) as (keyof typeof toastClassNames)[];
  it.each(keys)("toda classe de cor de '%s' termina com !", (key) => {
    for (const name of classesOf(key).filter((item) => COLOR_CLASS.test(item.replace(/!$/, "")))) {
      expect(name.endsWith("!"), `${key}: ${name}`).toBe(true);
    }
  });

  it("success e error têm classes de cor claras e escuras (o guarda não passa por vazio)", () => {
    for (const key of ["success", "error"] as const) {
      const colored = classesOf(key).filter((item) => COLOR_CLASS.test(item.replace(/!$/, "")));
      expect(colored).toHaveLength(6);
      expect(colored.filter((item) => item.startsWith("dark:"))).toHaveLength(3);
    }
  });

  it("as cores vivem só nas chaves por tipo: a chave base 'toast' não leva classe de cor", () => {
    expect(classesOf("toast").filter((item) => COLOR_CLASS.test(item.replace(/!$/, "")))).toEqual(
      [],
    );
  });
});

describe.each(THEMES)("cores dos toasts no tema %s (calculadas dos valores do tema)", (theme) => {
  it("o sucesso tem fundo e texto de matiz verde", () => {
    const { background, text } = resolve("success", theme);
    for (const color of [background, text]) {
      expect(color.c).toBeGreaterThan(0.01);
      expect(inRange(color.h, 110, 180)).toBe(true);
    }
  });

  it("o erro tem fundo e texto de matiz vermelho", () => {
    const { background, text } = resolve("error", theme);
    for (const color of [background, text]) {
      expect(color.c).toBeGreaterThan(0.01);
      expect(inRange(color.h, 0, 40)).toBe(true);
    }
  });

  it("a informação usa as cores neutras do tema: o fundo e o texto do próprio app", () => {
    const { background, text } = resolve("info", theme);
    expect(background).toEqual(appToken("background", theme));
    expect(text).toEqual(appToken("foreground", theme));
  });

  it("os três tipos têm fundos distintos e o verde e o vermelho ficam longe no círculo de matizes", () => {
    const [success, error, info] = TYPES.map((type) => resolve(type, theme).background) as [
      Oklch,
      Oklch,
      Oklch,
    ];
    expect(new Set([success, error, info].map((color) => JSON.stringify(color))).size).toBe(3);
    expect(hueGap(success.h, error.h)).toBeGreaterThan(90);
  });

  it.each(TYPES)("o texto do toast de %s tem contraste de pelo menos 4,5:1 com o fundo", (type) => {
    const { background, text } = resolve(type, theme);
    expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TYPES)(
    "o toast de %s usa tons do tema ativo (texto escuro no claro, texto claro no escuro)",
    (type) => {
      const { background, text } = resolve(type, theme);
      // light theme: dark text on a light surface; dark theme (`.dark`): light text on a dark surface
      if (theme === "light") expect(luminance(background)).toBeGreaterThan(luminance(text));
      else expect(luminance(background)).toBeLessThan(luminance(text));
    },
  );
});
