import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseOklch, type Oklch } from "@/test/colorContrast";
import { balanceClassName, summaryActiveRing, summaryColors } from "./summaryStyles";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const tailwindTheme = read("../../../node_modules/tailwindcss/theme.css");
const appStyles = read("../../styles.css");

type Theme = "light" | "dark";
const THEMES: Theme[] = ["light", "dark"];

const declaration = (css: string, name: string): string | undefined =>
  new RegExp(`${name}:\\s*(oklch\\([^)]*\\))\\s*;`).exec(css)?.[1];
const block = (selector: RegExp): string => selector.exec(appStyles)?.[1] ?? "";
const appBlocks = { light: block(/:root\s*\{([^}]*)\}/), dark: block(/\.dark\s*\{([^}]*)\}/) };

/** A theme token as the app defines it (`card`), the dark block falling back to `:root`. */
const appToken = (name: string, theme: Theme): Oklch => {
  const value =
    declaration(appBlocks[theme], `--${name}`) ?? declaration(appBlocks.light, `--${name}`);
  if (!value) throw new Error(`--${name} is not defined in styles.css`);
  return parseOklch(value);
};
/** The color a text class (`text-emerald-700`, `text-foreground`) stands for in a theme; `dark:` ones only in the dark theme. */
const textColor = (classes: string, theme: Theme): Oklch => {
  const names = classes.split(/\s+/);
  const picked = (theme === "dark" ? names.filter((name) => name.startsWith("dark:")) : []).concat(
    names.filter((name) => !name.startsWith("dark:")),
  )[0];
  const token = /^(?:dark:)?text-(.+)$/.exec(picked ?? "")?.[1];
  if (!token) throw new Error(`no text color in "${classes}" for ${theme}`);
  const palette = declaration(tailwindTheme, `--color-${token}`);
  return palette ? parseOklch(palette) : appToken(token, theme);
};

const TONES = ["income", "expense", "investments", "neutral"] as const;

describe.each(THEMES)(
  "cores do cartão de resumo no tema %s (calculadas dos valores do tema)",
  (theme) => {
    it.each(TONES)(
      "o texto de '%s' tem contraste de pelo menos 4,5:1 contra o fundo do cartão",
      (tone) => {
        const ratio = contrastRatio(textColor(summaryColors[tone], theme), appToken("card", theme));
        expect(ratio, `${tone} em ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      },
    );

    it("receitas são verdes, despesas vermelhas e investimentos azuis, e os três têm matizes distintos", () => {
      const [income, expense, investments] = (["income", "expense", "investments"] as const).map(
        (tone) => textColor(summaryColors[tone], theme),
      ) as [Oklch, Oklch, Oklch];
      for (const color of [income, expense, investments]) expect(color.c).toBeGreaterThan(0.05);
      expect(income.h).toBeGreaterThanOrEqual(110);
      expect(income.h).toBeLessThanOrEqual(180);
      expect(expense.h).toBeGreaterThanOrEqual(0);
      expect(expense.h).toBeLessThanOrEqual(40);
      expect(investments.h).toBeGreaterThanOrEqual(230);
      expect(investments.h).toBeLessThanOrEqual(270);
    });

    it("o anel do valor ativo tem contraste de pelo menos 3:1 (não texto) contra o fundo do cartão", () => {
      const token = /(?:^|\s)ring-(?!\d)(\S+)/.exec(summaryActiveRing)?.[1];
      expect(token, summaryActiveRing).toBeDefined();
      const palette = declaration(tailwindTheme, `--color-${token}`);
      const ring = palette ? parseOklch(palette) : appToken(token as string, theme);
      const ratio = contrastRatio(ring, appToken("card", theme));
      expect(ratio, `anel ${token} em ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
      expect(summaryActiveRing.split(/\s+/)).toContain("ring-2");
    });

    it("o tom neutro é a cor de texto do tema (--foreground)", () => {
      expect(textColor(summaryColors.neutral, theme)).toEqual(appToken("foreground", theme));
    });
  },
);

describe("summaryColors", () => {
  it("cada tom colorido tem a classe clara e a par com dark: (a verificação não passa por lista vazia)", () => {
    for (const tone of ["income", "expense", "investments"] as const) {
      const names = summaryColors[tone].split(/\s+/);
      expect(names, tone).toHaveLength(2);
      expect(
        names.filter((name) => name.startsWith("dark:")),
        tone,
      ).toHaveLength(1);
    }
  });
});

describe("balanceClassName", () => {
  it("saldo positivo usa as classes de receitas", () => {
    for (const balance of ["120.00", "0.01", "1234567.89"]) {
      expect(balanceClassName(balance), balance).toBe(summaryColors.income);
    }
  });

  it("saldo negativo usa as classes de despesas, até -0.01", () => {
    for (const balance of ["-0.01", "-50.00", "-1234567.89"]) {
      expect(balanceClassName(balance), balance).toBe(summaryColors.expense);
    }
  });

  it("saldo zero (0.00 ou -0.00) usa a cor de texto do tema", () => {
    for (const balance of ["0.00", "-0.00", "0"]) {
      expect(balanceClassName(balance), balance).toBe(summaryColors.neutral);
    }
  });
});
